// @ts-check
// Pure helpers shared by the service worker and the tests. No `chrome`, no `fetch`.

/** @typedef {{ ok: true, userName: string, slugs: string[], numSolved: number | null } | { ok: false, error: string, loggedOut?: true }} ParsedProblems */
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
    return {
      ok: false,
      error: "You are not logged in on leetcode.com. Log in and try again.",
      loggedOut: true,
    };
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
 * The oldest submission time on one /api/submissions/ page, in epoch seconds (null if none).
 * @param {unknown} page
 * @returns {number | null}
 */
export function oldestSubmissionTime(page) {
  if (!isRecord(page) || !Array.isArray(page.submissions_dump)) return null;
  /** @type {number | null} */
  let oldest = null;
  for (const sub of page.submissions_dump) {
    const ts = isRecord(sub) ? toEpochSeconds(sub.timestamp) : null;
    if (ts !== null && (oldest === null || ts < oldest)) oldest = ts;
  }
  return oldest;
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
 * Returns the origin of a LogN URL, or null unless it is https:// or http://localhost.
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

/** The hosted LogN: the default URL, and the only https one the manifest grants access to. */
export const LOGN_ORIGIN = "https://logn.techsavy.space";

/** The site before the rename to LogN (extension 0.3.x saved it as the URL). */
export const OLD_ORIGIN = "https://codelogs.techsavy.space";

/**
 * Whether the extension may connect to this normalized origin: the hosted LogN, or a local
 * dev server (any port, behind the optional `http://localhost/*` permission).
 * @param {string} base
 */
export function isAllowedBase(base) {
  return base === LOGN_ORIGIN || base.startsWith("http://localhost");
}

/**
 * The host permission that lets the extension call this LogN origin. It is granted at install
 * for the hosted LogN, but Chrome withholds it when the user limits the extension's site
 * access, and the API sends no CORS headers, so it has to be asked for again like LeetCode.
 * `http://localhost/*` covers every port.
 * @param {string} base  normalized origin
 */
export function basePermission(base) {
  return base.startsWith("http://localhost") ? "http://localhost/*" : `${base}/*`;
}
