// @ts-check
// Pure helpers shared by the service worker and the tests. No `chrome`, no `fetch`.

/** @typedef {{ ok: true, userName: string, slugs: string[], numSolved: number | null } | { ok: false, error: string }} ParsedProblems */
/** @typedef {{ slug: string, solvedAt: number | null }} Solve */

const SLUG_RE = /^[a-z0-9-]{1,120}$/;

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parses https://leetcode.com/api/problems/all/ (mirrors the server's parseLeetcodeProblemsAll).
 * @param {unknown} json
 * @returns {ParsedProblems}
 */
export function parseProblemsAll(json) {
  if (!isRecord(json) || !Array.isArray(json.stat_status_pairs)) {
    return { ok: false, error: "Unexpected response from leetcode.com." };
  }
  const userName = typeof json.user_name === "string" ? json.user_name.trim() : "";
  if (userName === "") {
    return { ok: false, error: "You are not logged in on leetcode.com. Log in and try again." };
  }
  /** @type {Set<string>} */
  const slugs = new Set();
  for (const pair of json.stat_status_pairs) {
    if (!isRecord(pair) || pair.status !== "ac" || !isRecord(pair.stat)) continue;
    const slug = pair.stat.question__title_slug;
    if (typeof slug === "string" && slug.length > 0) slugs.add(slug);
  }
  const numSolved =
    typeof json.num_solved === "number" && Number.isFinite(json.num_solved)
      ? json.num_solved
      : null;
  return { ok: true, userName, slugs: [...slugs], numSolved };
}

/**
 * @param {unknown} v
 * @returns {number | null} epoch seconds, or null if not a sane positive timestamp
 */
function toEpochSeconds(v) {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/**
 * Folds submission pages into a slug -> earliest Accepted timestamp map. Reads only title_slug,
 * status_display and timestamp; everything else (source code) is ignored.
 * @param {unknown[]} pages  responses of /api/submissions/
 * @param {Map<string, number>} [into]
 * @returns {Map<string, number>}
 */
export function collectAcceptedDates(pages, into = new Map()) {
  for (const page of pages) {
    if (!isRecord(page) || !Array.isArray(page.submissions_dump)) continue;
    for (const sub of page.submissions_dump) {
      if (!isRecord(sub) || sub.status_display !== "Accepted") continue;
      const slug = sub.title_slug;
      if (typeof slug !== "string" || slug === "") continue;
      const ts = toEpochSeconds(sub.timestamp);
      if (ts === null) continue;
      const prev = into.get(slug);
      if (prev === undefined || ts < prev) into.set(slug, ts);
    }
  }
  return into;
}

/**
 * @param {string} userName
 * @param {string[]} slugs  solved slugs
 * @param {Map<string, number>} [dates]
 * @returns {{ userName: string, solves: Solve[] }}
 */
export function buildUpload(userName, slugs, dates = new Map()) {
  /** @type {Solve[]} */
  const solves = [];
  const seen = new Set();
  for (const slug of slugs) {
    if (seen.has(slug) || !SLUG_RE.test(slug)) continue;
    seen.add(slug);
    solves.push({ slug, solvedAt: dates.get(slug) ?? null });
  }
  return { userName, solves };
}

/**
 * Returns the origin of a CodeLogs URL, or null unless it is https:// or http://localhost.
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeBaseUrl(input) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return null;
  }
  if (url.username !== "" || url.password !== "") return null;
  if (url.protocol === "https:") return url.origin;
  if (url.protocol === "http:" && url.hostname === "localhost") return url.origin;
  return null;
}
