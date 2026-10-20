// AtCoder adapter. Submissions and the problem catalog come from kenkoooo's AtCoderProblems
// API; handle validation and the verification field come from the atcoder.jp profile page
// (kenkoooo returns `200 []` for unknown users, so it can't validate). See FINDINGS.md.
// Pure: HTTP in, normalized data out. No DB, env or server-only imports.

import { PlatformUserNotFoundError } from "@/lib/adapters/errors";
import { HttpError, isRetryableError, request, requestJson } from "@/lib/adapters/http";
import type {
  CatalogAdapter,
  CatalogProblem,
  NormalizedSolve,
  PageToken,
  PlatformAdapter,
  SyncCursor,
  SyncPage,
  ValidateResult,
} from "@/lib/adapters/types";

const MIN_DELAY_MS = 1100;
/** kenkoooo returns at most this many submissions per request. */
const PAGE_SIZE = 500;

const SUBMISSIONS_URL = "https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions";
const PROBLEMS_URL = "https://kenkoooo.com/atcoder/resources/problems.json";
const MODELS_URL = "https://kenkoooo.com/atcoder/resources/problem-models.json";
const PROFILE_URL = "https://atcoder.jp/users/";

interface RawSubmission {
  id?: number;
  epoch_second: number;
  problem_id: string;
  contest_id?: string;
  result?: string;
}

interface RawProblem {
  id: string;
  contest_id: string;
  name?: string;
  title?: string;
}

interface RawProblemModel {
  difficulty?: number;
}

function taskUrl(contestId: string, problemId: string): string {
  return `https://atcoder.jp/contests/${encodeURIComponent(contestId)}/tasks/${encodeURIComponent(problemId)}`;
}

function isRawSubmission(row: unknown): row is RawSubmission {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.epoch_second === "number" &&
    Number.isFinite(r.epoch_second) &&
    typeof r.problem_id === "string" &&
    r.problem_id.length > 0
  );
}

function isRawProblem(row: unknown): row is RawProblem {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return typeof r.id === "string" && r.id.length > 0 && typeof r.contest_id === "string";
}

// ---- profile page parsing (regex; no HTML parser dependency) ----

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** AtCoder's own casing of the handle: the `.username` link in the profile header. */
function parseCanonicalHandle(html: string): string | null {
  const link = /<a[^>]*class="username"[^>]*>([\s\S]*?)<\/a>/i.exec(html);
  if (link?.[1]) {
    const name = decodeEntities(link[1].replace(/<[^>]*>/g, "")).trim();
    if (name) return name;
  }
  const title = /<title>\s*([^<]*?)\s+-\s+AtCoder\s*<\/title>/i.exec(html);
  const fromTitle = title?.[1] ? decodeEntities(title[1]).trim() : "";
  return fromTitle || null;
}

function parseAffiliation(html: string): string | null {
  const cell = /<th[^>]*>\s*Affiliation\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i.exec(html);
  if (!cell?.[1]) return null;
  const text = decodeEntities(cell[1].replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function profileUrl(handle: string): string {
  return `${PROFILE_URL}${encodeURIComponent(handle)}`;
}

function fetchProfile(handle: string) {
  return request(profileUrl(handle), {
    headers: { Accept: "text/html" },
    minIntervalMs: MIN_DELAY_MS,
  });
}

// ---- adapter ----

async function validateHandle(handle: string): Promise<ValidateResult> {
  try {
    const res = await fetchProfile(handle);
    if (res.status === 200) {
      return { result: "valid", canonicalHandle: parseCanonicalHandle(res.text) ?? handle };
    }
    if (res.status === 404) {
      return { result: "invalid", message: `No AtCoder user named "${handle}".` };
    }
    return { result: "retry", message: `AtCoder returned HTTP ${res.status}. Try again later.` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      result: "retry",
      message: isRetryableError(err)
        ? "Couldn't reach AtCoder. Try again in a moment."
        : `Unexpected AtCoder error: ${detail}`,
    };
  }
}

async function readVerificationField(handle: string): Promise<string | null> {
  const res = await fetchProfile(handle);
  if (res.status === 404) {
    throw new PlatformUserNotFoundError(`AtCoder user "${handle}" not found (HTTP 404)`);
  }
  if (!res.ok) {
    throw new HttpError(
      "status",
      profileUrl(handle),
      `HTTP ${res.status} from AtCoder profile`,
      res.status,
    );
  }
  return parseAffiliation(res.text);
}

/**
 * Page token = the `from_second` for this page's request (kenkoooo returns up to 500 rows with
 * epoch_second >= from_second, ascending). `page === null` starts at the cursor's `fromSecond`
 * (incremental sync) or 0 (first sync). `from_second` is inclusive, so boundary rows repeat
 * across pages; the sync job's upsert on (account, problem) absorbs that.
 */
async function fetchPage(
  handle: string,
  cursor: SyncCursor | null,
  page: PageToken | null,
): Promise<SyncPage> {
  const fromSecond = page ?? (cursor?.platform === "atcoder" ? cursor.fromSecond : 0);
  const query = new URLSearchParams({ user: handle, from_second: String(fromSecond) });
  const body = await requestJson<unknown>(`${SUBMISSIONS_URL}?${query.toString()}`, {
    minIntervalMs: MIN_DELAY_MS,
  });
  const rows = Array.isArray(body) ? body : [];

  let lastSecond = -1;
  const earliest = new Map<string, { second: number; contestId: string }>();
  for (const row of rows) {
    if (!isRawSubmission(row)) continue;
    lastSecond = Math.max(lastSecond, row.epoch_second);
    if (row.result !== "AC") continue;
    const seen = earliest.get(row.problem_id);
    if (!seen || row.epoch_second < seen.second) {
      earliest.set(row.problem_id, {
        second: row.epoch_second,
        contestId: row.contest_id ?? row.problem_id.split("_")[0] ?? row.problem_id,
      });
    }
  }

  const solves: NormalizedSolve[] = [...earliest].map(([problemId, { second, contestId }]) => ({
    platform: "atcoder",
    externalProblemId: problemId,
    firstSolvedAt: new Date(second * 1000),
    problemFallback: { title: problemId, url: taskUrl(contestId, problemId), rawTags: [] },
  }));

  // A full page may have more behind it. If every row shares one second, from_second can't
  // advance (it would refetch the same page forever), so stop.
  const nextPage = rows.length >= PAGE_SIZE && lastSecond > fromSecond ? lastSecond : null;

  return {
    snapshot: { solves, extras: [] },
    nextPage,
    resumeCursor: lastSecond >= 0 ? { platform: "atcoder", fromSecond: lastSecond } : null,
  };
}

export const atcoderAdapter: PlatformAdapter = {
  platform: "atcoder",
  minDelayMs: MIN_DELAY_MS,
  capabilities: {
    history: "full",
    topicTags: false,
    topicCounts: false,
    activityCalendar: false,
  },
  validateHandle,
  readVerificationField,
  fetchPage,
};

export const atcoderCatalog: CatalogAdapter = {
  platform: "atcoder",
  async fetchCatalog(): Promise<CatalogProblem[]> {
    const opts = { minIntervalMs: MIN_DELAY_MS, timeoutMs: 60_000 };
    const problems = await requestJson<unknown>(PROBLEMS_URL, opts);
    const models = await requestJson<unknown>(MODELS_URL, opts);
    const modelById: Record<string, RawProblemModel | undefined> =
      typeof models === "object" && models !== null && !Array.isArray(models)
        ? (models as Record<string, RawProblemModel | undefined>)
        : {};

    const out: CatalogProblem[] = [];
    for (const row of Array.isArray(problems) ? problems : []) {
      if (!isRawProblem(row)) continue;
      const difficulty = modelById[row.id]?.difficulty;
      out.push({
        platform: "atcoder",
        externalId: row.id,
        title: row.name || row.title || row.id,
        url: taskUrl(row.contest_id, row.id),
        difficultyRaw:
          typeof difficulty === "number" && Number.isFinite(difficulty) ? difficulty : undefined,
        rawTags: [],
      });
    }
    return out;
  },
};
