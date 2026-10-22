// Shared HTTP client for adapters: timeout, retry with backoff on 429/5xx/network errors,
// and per-host pacing inside one process. Pacing across Inngest steps is done with
// step.sleep(minDelayMs) in the sync job, since each step may run in a different invocation.
// Pure: no DB or env imports, so adapter fixture tests run offline.

const USER_AGENT = "LogN/0.1 (+https://github.com/savinyu/LogN; low volume)";

/** Swappable in tests: vi.spyOn(httpRuntime, "fetch") / vi.spyOn(httpRuntime, "sleep"). */
export const httpRuntime = {
  fetch: (input: string, init: RequestInit): Promise<Response> => fetch(input, init),
  sleep: (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)),
  now: (): number => Date.now(),
};

export type HttpErrorKind = "network" | "timeout" | "status" | "parse";

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  readonly url: string;
  readonly status?: number;
  /** Network errors, timeouts, 429 and 5xx: worth trying again later. */
  readonly retryable: boolean;

  constructor(kind: HttpErrorKind, url: string, message: string, status?: number) {
    super(message);
    this.name = "HttpError";
    this.kind = kind;
    this.url = url;
    this.status = status;
    this.retryable =
      kind === "network" ||
      kind === "timeout" ||
      (status !== undefined && isRetryableStatus(status));
  }
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  /** Parses `text`; throws HttpError("parse") on invalid JSON. */
  json<T = unknown>(): T;
}

export interface RequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /** Objects are JSON-encoded with Content-Type: application/json. */
  body?: string | Record<string, unknown>;
  /** Per attempt. Default 20 s. */
  timeoutMs?: number;
  /** Extra attempts after the first. Default 3. */
  retries?: number;
  /** Base for exponential backoff (base, 2×base, 4×base … ± jitter). Default 1000 ms. */
  backoffMs?: number;
  /** Minimum gap between requests to the same host in this process (the adapter's minDelayMs). */
  minIntervalMs?: number;
  /**
   * Extra retry condition on a response that would otherwise be returned, e.g. Codeforces'
   * `{"status":"FAILED","comment":"Call limit exceeded"}`.
   */
  retryIf?: (res: HttpResponse) => boolean;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 1_000;
const MAX_RETRY_AFTER_MS = 30_000;

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** True for errors a caller should surface as "try again later" (validateHandle → "retry"). */
export function isRetryableError(err: unknown): boolean {
  return err instanceof HttpError ? err.retryable : false;
}

const nextAllowedAt = new Map<string, number>();

/** Waits until `host` may be called again, then reserves the next slot. Safe under concurrency. */
async function pace(host: string, minIntervalMs: number): Promise<void> {
  if (minIntervalMs <= 0) return;
  const now = httpRuntime.now();
  const slot = Math.max(now, nextAllowedAt.get(host) ?? 0);
  nextAllowedAt.set(host, slot + minIntervalMs);
  if (slot > now) await httpRuntime.sleep(slot - now);
}

/** Test hook: forget pacing state between tests. */
export function resetHttpPacing(): void {
  nextAllowedAt.clear();
}

function backoffDelay(attempt: number, baseMs: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0)
      return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const exp = baseMs * 2 ** attempt;
  return exp + Math.floor(Math.random() * baseMs * 0.25);
}

function toResponse(url: string, res: Response, text: string): HttpResponse {
  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    text,
    json<T>() {
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new HttpError(
          "parse",
          url,
          `Invalid JSON from ${url} (HTTP ${res.status})`,
          res.status,
        );
      }
    },
  };
}

/**
 * Sends a request, retrying network errors, timeouts, 429, 5xx and `retryIf` matches.
 * Returns the final response for any HTTP status (callers inspect 4xx bodies, e.g. CF's
 * 400 for unknown handles). Throws HttpError("network" | "timeout") once retries run out.
 */
export async function request(url: string, opts: RequestOptions = {}): Promise<HttpResponse> {
  const {
    method = "GET",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    backoffMs = DEFAULT_BACKOFF_MS,
    minIntervalMs = 0,
    retryIf,
  } = opts;
  const host = new URL(url).host;
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    ...opts.headers,
  };
  let body: string | undefined;
  if (typeof opts.body === "string") body = opts.body;
  else if (opts.body) {
    body = JSON.stringify(opts.body);
    headers["Content-Type"] ??= "application/json";
  }

  for (let attempt = 0; ; attempt++) {
    await pace(host, minIntervalMs);
    let result: HttpResponse;
    try {
      const res = await httpRuntime.fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      result = toResponse(url, res, await res.text());
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      if (attempt < retries) {
        await httpRuntime.sleep(backoffDelay(attempt, backoffMs, null));
        continue;
      }
      throw timedOut
        ? new HttpError("timeout", url, `Timed out after ${timeoutMs} ms: ${url}`)
        : new HttpError("network", url, `Network error for ${url}: ${(err as Error).message}`);
    }

    const shouldRetry = isRetryableStatus(result.status) || (retryIf?.(result) ?? false);
    if (shouldRetry && attempt < retries) {
      await httpRuntime.sleep(backoffDelay(attempt, backoffMs, result.headers.get("retry-after")));
      continue;
    }
    return result;
  }
}

/** GET/POST expecting 2xx JSON. Throws HttpError("status") on any other status. */
export async function requestJson<T = unknown>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(url, opts);
  if (!res.ok) {
    throw new HttpError("status", url, `HTTP ${res.status} from ${url}`, res.status);
  }
  return res.json<T>();
}
