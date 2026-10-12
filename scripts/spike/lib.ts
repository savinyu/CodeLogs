// Shared helpers for the M0 data spike. Every spike script uses these so
// fixtures and findings come out in the same shape.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const ROOT = new URL("../../", import.meta.url).pathname;
const UA = "CodeLogs-spike/0.1 (+personal project; low volume)";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ProbeResult {
  name: string;
  url: string;
  status: number;
  ms: number;
  ok: boolean;
  note?: string;
}

/** fetch + JSON parse with a timeout. Never throws on HTTP errors; returns status. */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; ms: number; body: T | null; text: string }> {
  const t0 = Date.now();
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let body: T | null = null;
  try {
    body = JSON.parse(text) as T;
  } catch {
    /* non-JSON body; caller inspects text */
  }
  return { status: res.status, ms: Date.now() - t0, body, text };
}

/** Small, committed test fixture: fixtures/<platform>/<name>.json */
export async function saveFixture(platform: string, name: string, data: unknown) {
  return save(join(ROOT, "fixtures", platform, `${name}.json`), data);
}

/** Full-size dump, gitignored: spike-output/<platform>/<name>.json */
export async function saveDump(platform: string, name: string, data: unknown) {
  return save(join(ROOT, "spike-output", platform, `${name}.json`), data);
}

async function save(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
  return path;
}

/** Writes spike-output/<platform>/report.json and prints a table. */
export async function report(platform: string, probes: ProbeResult[], findings: string[]) {
  console.table(probes.map(({ name, status, ms, ok, note }) => ({ name, status, ms, ok, note })));
  console.log(`\nFindings (${platform}):\n- ` + findings.join("\n- "));
  await saveDump(platform, "report", {
    platform,
    ranAt: new Date().toISOString(),
    probes,
    findings,
  });
}
