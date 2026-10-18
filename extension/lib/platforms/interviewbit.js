// @ts-check
// InterviewBit. Identity is window.__INTERVIEWBIT__.user.username (read in the page, username
// only). Counts come from the public overview endpoint. The list walks the problem catalogue
// (/v2/problem_list/, 20 items per page) and keeps the problems the logged-in user has solved
// (has_solved); there are no solve dates. The calendar is the per-year daily submission counts.
import { ReaderError, buildPlatformUpload, expectData, isRecord, toCount } from "../common.js";

const NAME = "InterviewBit";
const PAGE_SIZE = 20;
const MAX_PAGES = 150;

/**
 * /v2/problem_list/problems_solved_overview_count?username=<h>
 * @param {unknown} json
 * @returns {{ total: number, byDifficulty: Record<string, number> } | null}
 */
export function parseOverview(json) {
  if (!isRecord(json)) return null;
  const total = toCount(json.total_problems_solved);
  if (total === null) return null;
  /** @type {Record<string, number>} */
  const byDifficulty = {};
  if (Array.isArray(json.difficulty_problems_solved)) {
    for (const d of json.difficulty_problems_solved) {
      if (!isRecord(d) || typeof d.difficulty_level !== "string") continue;
      const n = toCount(d.solved_problems_count);
      if (n !== null)
        byDifficulty[d.difficulty_level] = (byDifficulty[d.difficulty_level] ?? 0) + n;
    }
  }
  return { total, byDifficulty };
}

/** @param {string} slug @returns {string} */
function humanize(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * One page of /v2/problem_list/. Returns the solved items and how many items the page had.
 * @param {unknown} json
 * @returns {{ ok: true, count: number, solved: import("../common.js").UploadSolve[] } | { ok: false, error: string }}
 */
export function parseProblemListPage(json) {
  if (!isRecord(json) || !Array.isArray(json.items)) {
    return { ok: false, error: `${NAME} sent an unexpected problem list.` };
  }
  /** @type {import("../common.js").UploadSolve[]} */
  const solved = [];
  for (const it of json.items) {
    if (!isRecord(it) || it.has_solved !== true) continue;
    const slug = typeof it.slug === "string" && /^[A-Za-z0-9_-]+$/.test(it.slug) ? it.slug : null;
    if (!slug) continue;
    const nameField = [it.name, it.title, it.problem_name].find(
      (s) => typeof s === "string" && s.trim() !== "",
    );
    const statement = typeof it.problem_statement === "string" ? it.problem_statement.trim() : "";
    const title =
      typeof nameField === "string"
        ? nameField.trim()
        : statement !== "" && statement.length <= 100 && !statement.includes("\n")
          ? statement
          : humanize(slug);
    /** @type {string[]} */
    const tags = [];
    if (typeof it.topic_title === "string") tags.push(it.topic_title);
    for (const list of [it.tag_names, it.tags]) {
      if (!Array.isArray(list)) continue;
      for (const t of list) {
        if (typeof t === "string") tags.push(t);
        else if (isRecord(t) && typeof t.name === "string") tags.push(t.name);
      }
    }
    solved.push({
      id: slug,
      title,
      url: `https://www.interviewbit.com/problems/${encodeURIComponent(slug)}/`,
      difficulty:
        typeof it.difficulty_level === "string" && it.difficulty_level.trim() !== ""
          ? it.difficulty_level.trim()
          : null,
      tags: [...new Set(tags.map((t) => t.trim()).filter((t) => t !== "" && t.length <= 60))],
      solvedAt: null,
    });
  }
  return { ok: true, count: json.items.length, solved };
}

/**
 * /v2/profile/username/daily-user-submissions/<year>/?id=<h> : [{ date, count }]
 * @param {unknown} json
 * @returns {Array<{ day: string, count: number }>}
 */
export function parseDailySubmissions(json) {
  if (!Array.isArray(json)) return [];
  /** @type {Array<{ day: string, count: number }>} */
  const out = [];
  for (const d of json) {
    if (!isRecord(d) || typeof d.date !== "string") continue;
    const count = toCount(d.count);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.date) && count !== null) out.push({ day: d.date, count });
  }
  return out;
}

/**
 * @param {import("../job.js").ReaderContext} ctx
 * @returns {Promise<import("../common.js").PlatformUpload>}
 */
async function read(ctx) {
  const handle = await ctx.identity();
  if (!handle) throw new ReaderError(`Log in to ${NAME} in this browser, then try again.`);
  const h = encodeURIComponent(handle);

  ctx.progress("Reading your InterviewBit totals...");
  const overviewRes = await ctx.get(
    `/v2/problem_list/problems_solved_overview_count?username=${h}`,
  );
  const counts = overviewRes.status === 200 ? parseOverview(overviewRes.data) : null;

  /** @type {Map<string, import("../common.js").UploadSolve>} */
  const solved = new Map();
  let complete = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    ctx.progress(`Reading your InterviewBit problems (page ${page + 1})...`);
    const res = await ctx.get(
      `/v2/problem_list/?page_offset=${page * PAGE_SIZE}&page_limit=${PAGE_SIZE}`,
    );
    if (res.status !== 200 && page > 0) break;
    const parsed = parseProblemListPage(expectData(NAME, res, "the problem list"));
    if (!parsed.ok) {
      if (page > 0) break;
      throw new ReaderError(parsed.error);
    }
    for (const s of parsed.solved) solved.set(s.id, s);
    if (parsed.count === 0) {
      complete = true;
      break;
    }
    // Everything the overview counts has been found: the rest of the catalogue is unsolved.
    if (counts && solved.size >= counts.total) {
      complete = true;
      break;
    }
  }
  const listComplete = complete && (counts === null || solved.size === counts.total);

  ctx.progress("Reading your InterviewBit activity...");
  const year = new Date(ctx.now()).getUTCFullYear();
  /** @type {Array<{ day: string, count: number }>} */
  const activity = [];
  for (const y of [year - 1, year]) {
    const res = await ctx.get(`/v2/profile/username/daily-user-submissions/${y}/?id=${h}`);
    if (res.status === 200) activity.push(...parseDailySubmissions(res.data));
  }

  if (!counts && solved.size === 0) {
    throw new ReaderError(`Could not read any solved problems from ${NAME}.`);
  }
  return buildPlatformUpload({
    platform: "interviewbit",
    loggedInAs: handle,
    counts,
    solves: [...solved.values()],
    listComplete,
    activity,
  });
}

export const interviewbit = {
  id: "interviewbit",
  name: NAME,
  origin: "https://www.interviewbit.com",
  homeUrl: "https://www.interviewbit.com/practice/",
  permissions: ["https://www.interviewbit.com/*"],
  /** @type {import("../job.js").PageCall[]} */
  identitySteps: [
    { fn: "readGlobal", args: [["__INTERVIEWBIT__", "user", "username"]], world: "MAIN" },
  ],
  maxPages: MAX_PAGES,
  read,
};
