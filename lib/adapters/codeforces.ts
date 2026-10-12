// Codeforces adapter (official API, no auth). Facts: scripts/spike/FINDINGS.md.
// Pure: HTTP in, normalized data out. No DB, env or server-only imports.
//
// PageToken semantics for fetchPage(handle, cursor, page), one HTTP request per call:
//   page === null  user.info -> cf_rating extra, no solves. nextPage = 1, resumeCursor = null.
//   page = k >= 1  and cursor === null (first sync):
//                  user.status with no from/count = the whole history in one call.
//                  nextPage = null; resumeCursor = max submission id over ALL verdicts.
//   page = k >= 1  and cursor present (incremental): user.status?from=k&count=50 (newest first).
//                  Only submissions with id > cursor.maxSubmissionId count. If the page was full
//                  (50 rows) and every row was new, nextPage = k + 50 (the next `from`); otherwise
//                  null. resumeCursor is reported on k === 1 only (max new id, null if none).
// Solves are verdict "OK" only, deduped per problem within the page, keeping the earliest
// creationTimeSeconds as firstSolvedAt. Difficulty is the raw rating; normalising happens elsewhere.

import {
  HttpError,
  isRetryableError,
  request,
  type HttpResponse,
  type RequestOptions,
} from "@/lib/adapters/http";
import type {
  CatalogAdapter,
  CatalogProblem,
  NormalizedSolve,
  PageToken,
  PlatformAdapter,
  PlatformExtra,
  SyncCursor,
  SyncPage,
  ValidateResult,
} from "@/lib/adapters/types";

const BASE_URL = "https://codeforces.com/api/";
const MIN_DELAY_MS = 2000;
const PAGE_SIZE = 50;
const BIG_TIMEOUT_MS = 60_000;
/** Contest ids from 100000 up are gym contests, which live under /gym/. */
const GYM_MIN_CONTEST_ID = 100_000;

// --- Raw API shapes (only the fields we read) ---

interface CfEnvelope<T> {
  status: "OK" | "FAILED";
  comment?: string;
  result?: T;
}

interface CfUser {
  handle: string;
  rating?: number;
  maxRating?: number;
  rank?: string;
  maxRank?: string;
  organization?: string;
}

interface CfProblem {
  contestId?: number;
  index: string;
  name: string;
  rating?: number;
  tags?: string[];
}

interface CfSubmission {
  id: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: CfProblem;
}

interface CfProblemset {
  problems: CfProblem[];
}

// --- HTTP helpers ---

function isCallLimit(res: HttpResponse): boolean {
  return res.text.includes("Call limit exceeded");
}

interface ApiResult<T> {
  url: string;
  httpStatus: number;
  body: CfEnvelope<T> | null;
  res: HttpResponse;
}

async function callApi<T>(
  method: string,
  params: Record<string, string | number>,
  opts: Pick<RequestOptions, "timeoutMs"> = {},
): Promise<ApiResult<T>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) query.set(key, String(value));
  const qs = query.toString();
  const url = `${BASE_URL}${method}${qs ? `?${qs}` : ""}`;
  const res = await request(url, {
    ...opts,
    minIntervalMs: MIN_DELAY_MS,
    retryIf: isCallLimit,
  });
  let body: CfEnvelope<T> | null = null;
  try {
    body = res.json<CfEnvelope<T>>();
  } catch {
    // Non-JSON body (e.g. an HTML error page); callers treat it as a failure by status.
  }
  return { url, httpStatus: res.status, body, res };
}

/** Returns `result` of an OK response, or throws a descriptive Error. */
function unwrap<T>(method: string, api: ApiResult<T>): T {
  const { body, httpStatus } = api;
  if (body?.status === "OK" && body.result !== undefined) return body.result;
  const detail = body?.comment ?? `HTTP ${httpStatus}`;
  // Throttled or down even after the http client's retries: let the sync job retry the step.
  if (isTransient(api)) {
    const status = isCallLimit(api.res) ? 429 : httpStatus; // so HttpError.retryable is true
    throw new HttpError("status", api.url, `Codeforces ${method} unavailable: ${detail}`, status);
  }
  throw new Error(`Codeforces ${method} failed: ${detail}`);
}

/** True for responses worth retrying later: 429, 5xx, or the call-limit message. */
function isTransient(api: ApiResult<unknown>): boolean {
  return api.httpStatus === 429 || api.httpStatus >= 500 || isCallLimit(api.res);
}

// --- Mapping helpers ---

function problemKey(p: CfProblem & { contestId: number }): string {
  return `${p.contestId}${p.index}`;
}

function problemUrl(contestId: number, index: string): string {
  return contestId >= GYM_MIN_CONTEST_ID
    ? `https://codeforces.com/gym/${contestId}/problem/${index}`
    : `https://codeforces.com/problemset/problem/${contestId}/${index}`;
}

function hasContestId(p: CfProblem): p is CfProblem & { contestId: number } {
  return typeof p.contestId === "number";
}

function solvesFrom(submissions: CfSubmission[]): NormalizedSolve[] {
  const byProblem = new Map<string, NormalizedSolve>();
  for (const sub of submissions) {
    if (sub.verdict !== "OK" || !hasContestId(sub.problem)) continue;
    const problem = sub.problem;
    const key = problemKey(problem);
    const solvedAt = new Date(sub.creationTimeSeconds * 1000);
    const existing = byProblem.get(key);
    if (existing) {
      if (existing.firstSolvedAt && solvedAt < existing.firstSolvedAt) {
        existing.firstSolvedAt = solvedAt;
      }
      continue;
    }
    byProblem.set(key, {
      platform: "codeforces",
      externalProblemId: key,
      firstSolvedAt: solvedAt,
      problemFallback: {
        title: problem.name,
        url: problemUrl(problem.contestId, problem.index),
        difficultyRaw: problem.rating,
        rawTags: problem.tags ?? [],
      },
    });
  }
  return [...byProblem.values()];
}

function maxId(submissions: CfSubmission[]): number | null {
  let max: number | null = null;
  for (const s of submissions) if (max === null || s.id > max) max = s.id;
  return max;
}

function cursorFor(maxSubmissionId: number | null): SyncCursor | null {
  return maxSubmissionId === null ? null : { platform: "codeforces", maxSubmissionId };
}

function emptySnapshot(extras: PlatformExtra[] = []) {
  return { solves: [], extras };
}

// --- Adapter ---

async function fetchUserInfo(handle: string): Promise<CfUser> {
  const api = await callApi<CfUser[]>("user.info", { handles: handle });
  if (api.body?.status === "FAILED" && api.httpStatus === 400) {
    throw new Error(`Codeforces user "${handle}" not found (${api.body.comment ?? "HTTP 400"})`);
  }
  const user = unwrap("user.info", api)[0];
  if (!user) throw new Error(`Codeforces user.info returned no user for "${handle}"`);
  return user;
}

async function fetchPage(
  handle: string,
  cursor: SyncCursor | null,
  page: PageToken | null,
): Promise<SyncPage> {
  if (page === null) {
    const user = await fetchUserInfo(handle);
    const extra: PlatformExtra = {
      kind: "cf_rating",
      payload: {
        rating: user.rating ?? null,
        maxRating: user.maxRating ?? null,
        rank: user.rank ?? null,
        maxRank: user.maxRank ?? null,
      },
    };
    return { snapshot: emptySnapshot([extra]), nextPage: 1, resumeCursor: null };
  }

  const lastSeen = cursor?.platform === "codeforces" ? cursor.maxSubmissionId : null;

  if (lastSeen === null) {
    // First sync: the whole history in one call.
    const api = await callApi<CfSubmission[]>(
      "user.status",
      { handle },
      { timeoutMs: BIG_TIMEOUT_MS },
    );
    const submissions = unwrap("user.status", api);
    return {
      snapshot: { solves: solvesFrom(submissions), extras: [] },
      nextPage: null,
      resumeCursor: cursorFor(maxId(submissions)),
    };
  }

  const api = await callApi<CfSubmission[]>("user.status", {
    handle,
    from: page,
    count: PAGE_SIZE,
  });
  const rows = unwrap("user.status", api);
  const fresh = rows.filter((s) => s.id > lastSeen);
  const reachedOld = fresh.length < rows.length;
  const hasMore = rows.length >= PAGE_SIZE && !reachedOld;
  return {
    snapshot: { solves: solvesFrom(fresh), extras: [] },
    nextPage: hasMore ? page + PAGE_SIZE : null,
    resumeCursor: page === 1 ? cursorFor(maxId(fresh)) : null,
  };
}

async function validateHandle(handle: string): Promise<ValidateResult> {
  try {
    const api = await callApi<CfUser[]>("user.info", { handles: handle });
    if (api.httpStatus === 200 && api.body?.status === "OK") {
      const user = api.body.result?.[0];
      if (user) return { result: "valid", canonicalHandle: user.handle };
      return { result: "invalid", message: `No Codeforces user named "${handle}".` };
    }
    if (isTransient(api)) {
      return { result: "retry", message: "Codeforces is busy or unavailable. Try again shortly." };
    }
    if (api.httpStatus === 400 && api.body?.status === "FAILED") {
      return { result: "invalid", message: `No Codeforces user named "${handle}".` };
    }
    return {
      result: "retry",
      message: `Unexpected response from Codeforces (HTTP ${api.httpStatus}). Try again shortly.`,
    };
  } catch (err) {
    if (isRetryableError(err)) {
      return { result: "retry", message: "Could not reach Codeforces. Try again shortly." };
    }
    return {
      result: "retry",
      message: `Codeforces check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function readVerificationField(handle: string): Promise<string | null> {
  const user = await fetchUserInfo(handle);
  const org = user.organization?.trim();
  return org ? org : null;
}

export const codeforcesAdapter: PlatformAdapter = {
  platform: "codeforces",
  minDelayMs: MIN_DELAY_MS,
  capabilities: { history: "full", topicTags: true, topicCounts: false, activityCalendar: false },
  validateHandle,
  readVerificationField,
  fetchPage,
};

export const codeforcesCatalog: CatalogAdapter = {
  platform: "codeforces",
  async fetchCatalog(): Promise<CatalogProblem[]> {
    const api = await callApi<CfProblemset>(
      "problemset.problems",
      {},
      { timeoutMs: BIG_TIMEOUT_MS },
    );
    const { problems } = unwrap("problemset.problems", api);
    const out: CatalogProblem[] = [];
    for (const p of problems) {
      if (!hasContestId(p)) continue;
      out.push({
        platform: "codeforces",
        externalId: problemKey(p),
        title: p.name,
        url: problemUrl(p.contestId, p.index),
        difficultyRaw: p.rating,
        rawTags: p.tags ?? [],
      });
    }
    return out;
  },
};
