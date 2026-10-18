// @ts-check
// CodeChef. Identity is /api/user/me (user.username). The solved count and the daily calendar
// come from the profile page's HTML; the list comes from /recent/user, a JSON wrapper around an
// HTML table of every submission (accepted ones are kept, earliest per problem code).
// There is no DOMParser in a service worker, so the HTML is read with regular expressions.
import {
  ReaderError,
  buildPlatformUpload,
  expectData,
  isRecord,
  istToEpoch,
  stripTags,
  toCount,
} from "../common.js";

const NAME = "CodeChef";
const MAX_PAGES = 400;

/**
 * "Total Problems Solved: 632" in the profile HTML.
 * @param {string} html
 * @returns {number | null}
 */
export function parseSolvedCount(html) {
  const m = /Total\s+Problems\s+Solved:?\s*(?:<[^>]*>\s*)*(\d[\d,]*)/i.exec(html);
  return m && m[1] ? toCount(m[1].replace(/,/g, "")) : null;
}

/**
 * `userDailySubmissionsStats = [{date:'YYYY-MM-DD', value:N}, ...]` in the profile HTML; the
 * first non-empty assignment wins. Returns [] when the page leaves it for the browser to fill.
 * @param {string} html
 * @returns {Array<{ day: string, count: number }>}
 */
export function parseDailyStats(html) {
  const arrays = html.matchAll(/userDailySubmissionsStats\s*=\s*(\[[^\]]*\])/g);
  for (const arr of arrays) {
    const entries = (arr[1] ?? "").matchAll(
      /["']?date["']?\s*:\s*["'](\d{4}-\d{2}-\d{2})["']\s*,\s*["']?value["']?\s*:\s*["']?(\d+)/g,
    );
    /** @type {Array<{ day: string, count: number }>} */
    const out = [];
    for (const e of entries) {
      const count = toCount(e[2]);
      if (e[1] && count !== null) out.push({ day: e[1], count });
    }
    if (out.length > 0) return out;
  }
  return [];
}

/**
 * "11:45 PM 25/12/23" (India time) to epoch seconds.
 * @param {string} text
 * @returns {number | null}
 */
export function parseSubmissionTime(text) {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)\s+(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/i.exec(text);
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if ((m[3] ?? "").toUpperCase() === "PM") hour += 12;
  const yy = Number(m[6]);
  return istToEpoch(yy < 100 ? 2000 + yy : yy, Number(m[5]), Number(m[4]), hour, Number(m[2]));
}

/**
 * Parses one /recent/user page. Only accepted submissions come back as rows.
 * @param {unknown} json  { content: "<html table>", max_page: N }
 * @returns {{ ok: true, rows: Array<{ code: string, title: string, solvedAt: number | null }>, rowCount: number, maxPage: number | null } | { ok: false, error: string }}
 */
export function parseRecentPage(json) {
  if (!isRecord(json) || typeof json.content !== "string") {
    return { ok: false, error: `${NAME} sent an unexpected submissions page.` };
  }
  const maxPage = toCount(json.max_page);
  /** @type {Array<{ code: string, title: string, solvedAt: number | null }>} */
  const rows = [];
  let rowCount = 0;
  for (const tr of json.content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const html = tr[1] ?? "";
    const link =
      /<a\b[^>]*href\s*=\s*["'](?:https?:\/\/www\.codechef\.com)?(?:\/[A-Za-z0-9_-]+)?\/problems\/([A-Za-z0-9_]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(
        html,
      );
    if (!link || !link[1]) continue; // header rows and rows without a problem
    rowCount++;
    if (!/title\s*=\s*["']\s*accepted\s*["']/i.test(html)) continue;
    const code = link[1];
    const text = stripTags(link[2] ?? "");
    rows.push({ code, title: text || code, solvedAt: parseSubmissionTime(stripTags(html)) });
  }
  return { ok: true, rows, rowCount, maxPage };
}

/**
 * Folds accepted rows into code -> earliest solve.
 * @param {Map<string, { title: string, solvedAt: number | null }>} into
 * @param {Array<{ code: string, title: string, solvedAt: number | null }>} rows
 */
export function collectAccepted(into, rows) {
  for (const r of rows) {
    const prev = into.get(r.code);
    if (!prev) {
      into.set(r.code, { title: r.title, solvedAt: r.solvedAt });
    } else if (r.solvedAt !== null && (prev.solvedAt === null || r.solvedAt < prev.solvedAt)) {
      prev.solvedAt = r.solvedAt;
    }
  }
}

/**
 * @param {import("../job.js").ReaderContext} ctx
 * @returns {Promise<import("../common.js").PlatformUpload>}
 */
async function read(ctx) {
  const handle = await ctx.identity();
  if (!handle) throw new ReaderError(`Log in to ${NAME} in this browser, then try again.`);
  const h = encodeURIComponent(handle);

  ctx.progress("Reading your CodeChef profile...");
  const profile = await ctx.get(`/users/${h}`, { as: "text" });
  const html = typeof profile.data === "string" && profile.status === 200 ? profile.data : "";
  const total = parseSolvedCount(html);
  const activity = parseDailyStats(html);

  /** @type {Map<string, { title: string, solvedAt: number | null }>} */
  const accepted = new Map();
  let complete = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    ctx.progress(`Reading your CodeChef submissions (page ${page + 1})...`);
    const res = await ctx.get(`/recent/user?user_handle=${h}&page=${page}`);
    if (res.status !== 200 && page > 0) break;
    const parsed = parseRecentPage(expectData(NAME, res, "your submissions"));
    if (!parsed.ok) {
      if (page > 0) break;
      throw new ReaderError(parsed.error);
    }
    collectAccepted(accepted, parsed.rows);
    if (parsed.rowCount === 0 || (parsed.maxPage !== null && page >= parsed.maxPage)) {
      complete = true;
      break;
    }
  }

  const solves = [...accepted].map(([code, v]) => ({
    id: code,
    title: v.title,
    url: `https://www.codechef.com/problems/${encodeURIComponent(code)}`,
    difficulty: null,
    tags: [],
    solvedAt: v.solvedAt,
  }));
  if (total === null && solves.length === 0 && !complete) {
    throw new ReaderError(`Could not read any solved problems from ${NAME}.`);
  }
  return buildPlatformUpload({
    platform: "codechef",
    loggedInAs: handle,
    counts: total === null ? null : { total, byDifficulty: {} },
    solves,
    listComplete: complete,
    activity,
  });
}

export const codechef = {
  id: "codechef",
  name: NAME,
  origin: "https://www.codechef.com",
  homeUrl: "https://www.codechef.com/",
  permissions: ["https://www.codechef.com/*"],
  /** @type {import("../job.js").PageCall[]} */
  identitySteps: [
    { fn: "readJsonField", args: ["/api/user/me", ["user", "username"]] },
    { fn: "readGlobal", args: [["Drupal", "settings", "username"]], world: "MAIN" },
    { fn: "readLinkHandle", args: ["^/users/([^/?#]+)/?$"] },
  ],
  maxPages: MAX_PAGES,
  read,
};
