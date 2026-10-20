// @ts-check
// HackerRank. Identity is /rest/contests/master/hackers/me (model.username), falling back to the
// redux state embedded in the page. The list comes from the user's own submissions
// (/rest/contests/master/submissions/): every attempt, so accepted ones are kept and the earliest
// per challenge is its solve date. Submission sources are never requested.
import {
  buildPlatformUpload,
  expectData,
  getPage,
  isRecord,
  NotLoggedInError,
  ReaderError,
  toCount,
  toEpochSeconds,
} from "../common.js";

const NAME = "HackerRank";
const LIMIT = 50;
const MAX_PAGES = 200;

/**
 * Sum of `solved` over /rest/hackers/<h>/badges models. Domains overlap, so this is an upper bound.
 * @param {unknown} json
 * @returns {number | null}
 */
export function parseBadgesSolved(json) {
  if (!isRecord(json) || !Array.isArray(json.models)) return null;
  let sum = 0;
  let seen = false;
  for (const m of json.models) {
    if (!isRecord(m)) continue;
    const n = toCount(m.solved);
    if (n === null) continue;
    sum += n;
    seen = true;
  }
  return seen ? sum : null;
}

/**
 * /rest/hackers/<h>/submission_histories: { "2023-04-02": 3, ... }, submissions per day.
 * @param {unknown} json
 * @returns {Array<{ day: string, count: number }>}
 */
export function parseSubmissionHistories(json) {
  if (!isRecord(json)) return [];
  /** @type {Array<{ day: string, count: number }>} */
  const out = [];
  for (const [day, v] of Object.entries(json)) {
    const count = toCount(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && count !== null) out.push({ day, count });
  }
  return out;
}

/** @param {unknown} status */
export function isAccepted(status) {
  if (typeof status !== "string") return false;
  const s = status.trim().toLowerCase();
  return s === "ac" || s.startsWith("accepted");
}

/**
 * One page of /rest/contests/master/submissions/.
 * @param {unknown} json
 * @returns {{ ok: true, count: number, total: number | null, accepted: Array<{ slug: string, title: string, solvedAt: number | null }> } | { ok: false, error: string }}
 */
export function parseSubmissionsPage(json) {
  if (!isRecord(json) || !Array.isArray(json.models)) {
    return { ok: false, error: `${NAME} sent an unexpected submissions page.` };
  }
  /** @type {Array<{ slug: string, title: string, solvedAt: number | null }>} */
  const accepted = [];
  for (const m of json.models) {
    if (!isRecord(m) || !isAccepted(m.status)) continue;
    const ch = isRecord(m.challenge) ? m.challenge : {};
    const slug = [ch.slug, m.challenge_slug, m.ch_slug].find(
      (s) => typeof s === "string" && /^[A-Za-z0-9_-]+$/.test(s),
    );
    if (typeof slug !== "string") continue;
    const name = [ch.name, m.challenge_name].find((s) => typeof s === "string" && s.trim() !== "");
    accepted.push({
      slug,
      title: typeof name === "string" ? name.trim() : slug,
      solvedAt: toEpochSeconds(m.created_at ?? m.submitted_at),
    });
  }
  return { ok: true, count: json.models.length, total: toCount(json.total), accepted };
}

/**
 * @param {import("../job.js").ReaderContext} ctx
 * @returns {Promise<import("../common.js").PlatformUpload>}
 */
async function read(ctx) {
  const handle = await ctx.identity();
  if (!handle) throw new NotLoggedInError(`Log in to ${NAME} in this browser, then try again.`);
  const h = encodeURIComponent(handle);

  ctx.progress("Reading your HackerRank totals...");
  let badgesTotal = null;
  const badges = await ctx.get(`/rest/hackers/${h}/badges`);
  if (badges.status === 200) badgesTotal = parseBadgesSolved(badges.data);

  ctx.progress("Reading your HackerRank activity...");
  const histories = await ctx.get(`/rest/hackers/${h}/submission_histories`);
  const activity = histories.status === 200 ? parseSubmissionHistories(histories.data) : [];

  /** @type {Map<string, { title: string, solvedAt: number | null }>} */
  const bySlug = new Map();
  let complete = false;
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    ctx.progress(`Reading your HackerRank submissions (page ${page + 1})...`);
    const res = await getPage(
      ctx,
      `/rest/contests/master/submissions/?offset=${offset}&limit=${LIMIT}`,
      page === 0,
    );
    if (!res || (res.status !== 200 && page > 0)) break;
    const parsed = parseSubmissionsPage(expectData(NAME, res, "your submissions"));
    if (!parsed.ok) {
      if (page > 0) break;
      throw new ReaderError(parsed.error);
    }
    for (const a of parsed.accepted) {
      const prev = bySlug.get(a.slug);
      if (!prev) bySlug.set(a.slug, { title: a.title, solvedAt: a.solvedAt });
      else if (a.solvedAt !== null && (prev.solvedAt === null || a.solvedAt < prev.solvedAt)) {
        prev.solvedAt = a.solvedAt;
      }
    }
    // Advance by what the server returned: it may cap pages below LIMIT, and a short page is only
    // the end of the list when the total is unknown.
    offset += parsed.count;
    const done = parsed.total !== null ? offset >= parsed.total : parsed.count < LIMIT;
    if (parsed.count === 0 || done) {
      complete = true;
      break;
    }
  }

  const solves = [...bySlug].map(([slug, v]) => ({
    id: slug,
    title: v.title,
    url: `https://www.hackerrank.com/challenges/${encodeURIComponent(slug)}`,
    difficulty: null,
    tags: [],
    solvedAt: v.solvedAt,
  }));
  // A complete list is the exact count of challenges solved; the badges overlap across domains.
  const total = complete ? solves.length : (badgesTotal ?? solves.length);
  // A complete empty list is a real zero: it's uploaded so the handle is verified.
  if (!complete && total === 0 && activity.length === 0) {
    throw new ReaderError(`Could not read any solved challenges from ${NAME}.`);
  }
  return buildPlatformUpload({
    platform: "hackerrank",
    loggedInAs: handle,
    counts: { total, byDifficulty: {} },
    solves,
    listComplete: complete,
    activity,
  });
}

export const hackerrank = {
  id: "hackerrank",
  name: NAME,
  origin: "https://www.hackerrank.com",
  homeUrl: "https://www.hackerrank.com/dashboard",
  permissions: ["https://www.hackerrank.com/*"],
  /** @type {import("../job.js").PageCall[]} */
  identitySteps: [
    { fn: "readJsonField", args: ["/rest/contests/master/hackers/me", ["model", "username"]] },
    { fn: "readInitialData", args: [["community", "profile", "username"]] },
    { fn: "readLinkHandle", args: ["^/profile/([^/?#]+)/?$"] },
  ],
  maxPages: MAX_PAGES,
  read,
};
