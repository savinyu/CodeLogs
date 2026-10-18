// @ts-check
// Code360 (Coding Ninjas, on naukri.com). Identity is auth_details, of which ONLY data.uuid is
// read (the response also holds the user's email and access token). The solved counts come from
// the public profile endpoint and the list from view_solved_problems (login required). Identity
// is read again at the end: if the logged-in account changed mid-sync, the upload is dropped.
import {
  buildPlatformUpload,
  expectData,
  isRecord,
  NotLoggedInError,
  ReaderError,
  toCount,
  toEpochSeconds,
} from "../common.js";

const NAME = "Code360";
const MAX_PAGES = 100;
const API = "/code360/api";

/**
 * dsa_domain_data.problem_count_data of the public user_details response.
 * @param {unknown} json
 * @returns {{ total: number, byDifficulty: Record<string, number> } | null}
 */
export function parseUserDetails(json) {
  if (!isRecord(json) || !isRecord(json.dsa_domain_data)) return null;
  const pcd = json.dsa_domain_data.problem_count_data;
  if (!isRecord(pcd)) return null;
  const total = toCount(pcd.total_count);
  if (total === null) return null;
  /** @type {Record<string, number>} */
  const byDifficulty = {};
  if (Array.isArray(pcd.difficulty_data)) {
    for (const d of pcd.difficulty_data) {
      if (!isRecord(d) || typeof d.level !== "string") continue;
      const n = toCount(d.count);
      if (n !== null) byDifficulty[d.level] = n;
    }
  }
  return { total, byDifficulty };
}

/**
 * Pulls the problem slug out of a coding-problem link; MCQs and other rows return null.
 * @param {unknown} link  "/code360/problems/two-sum_123", an absolute naukri.com or codingninjas.com URL
 * @returns {string | null}
 */
export function problemSlug(link) {
  if (typeof link !== "string") return null;
  let path = link.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (
        !["www.naukri.com", "naukri.com", "www.codingninjas.com", "codingninjas.com"].includes(
          u.hostname,
        )
      ) {
        return null;
      }
      path = u.pathname;
    } catch {
      return null;
    }
  } else if (/^(?:www\.)?codingninjas\.com\//i.test(path)) {
    path = path.slice(path.indexOf("/"));
  }
  const m = /^\/(?:code360|studio)\/problems\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/.exec(path);
  return m && m[1] ? m[1] : null;
}

/**
 * One page of view_solved_problems. Reads only link, problem_name and solved_at of each row.
 * @param {unknown} json
 * @returns {{ ok: true, totalPages: number | null, solves: Array<{ id: string, title: string, solvedAt: number | null }> } | { ok: false, error: string }}
 */
export function parseSolvedPage(json) {
  const root = isRecord(json) && isRecord(json.data) ? json.data : json;
  if (!isRecord(root) || !Array.isArray(root.problem_submissions)) {
    return { ok: false, error: `${NAME} sent an unexpected solved list.` };
  }
  /** @type {Array<{ id: string, title: string, solvedAt: number | null }>} */
  const solves = [];
  for (const row of root.problem_submissions) {
    if (!isRecord(row)) continue;
    const id = problemSlug(row.link);
    if (!id) continue;
    const name = typeof row.problem_name === "string" ? row.problem_name.trim() : "";
    // Relative text such as "2 hours ago" is not a date, so toEpochSeconds leaves it undated.
    solves.push({ id, title: name || id, solvedAt: toEpochSeconds(row.solved_at) });
  }
  return { ok: true, totalPages: toCount(root.total_pages), solves };
}

/**
 * @param {import("../job.js").ReaderContext} ctx
 * @returns {Promise<import("../common.js").PlatformUpload>}
 */
async function read(ctx) {
  const uuid = await ctx.identity();
  if (!uuid) throw new NotLoggedInError(`Log in to ${NAME} in this browser, then try again.`);

  ctx.progress("Reading your Code360 totals...");
  const detailsRes = await ctx.get(
    `${API}/v3/public_section/profile/user_details?uuid=${encodeURIComponent(uuid)}&request_differentiator=1&app_context=publicsection&naukri_request=true`,
  );
  const counts = detailsRes.status === 200 ? parseUserDetails(detailsRes.data) : null;

  /** @type {Map<string, { title: string, solvedAt: number | null }>} */
  const byId = new Map();
  let complete = false;
  let totalPages = 1;
  for (let page = 1; page <= MAX_PAGES; page++) {
    ctx.progress(
      `Reading your Code360 solved problems (page ${page}${totalPages > 1 ? ` of ${totalPages}` : ""})...`,
    );
    const res = await ctx.get(
      `${API}/v3/public_section/profile/view_solved_problems?page=${page}&naukri_request=true`,
    );
    if (res.status !== 200 && page > 1) break;
    const parsed = parseSolvedPage(expectData(NAME, res, "your solved problems"));
    if (!parsed.ok) {
      if (page > 1) break;
      throw new ReaderError(parsed.error);
    }
    for (const s of parsed.solves) {
      const prev = byId.get(s.id);
      if (!prev) byId.set(s.id, { title: s.title, solvedAt: s.solvedAt });
      else if (s.solvedAt !== null && (prev.solvedAt === null || s.solvedAt < prev.solvedAt)) {
        prev.solvedAt = s.solvedAt;
      }
    }
    if (parsed.totalPages !== null) totalPages = parsed.totalPages;
    if (page >= totalPages || (parsed.totalPages === null && parsed.solves.length === 0)) {
      complete = true;
      break;
    }
  }

  const again = await ctx.identity();
  if (again !== uuid) {
    throw new ReaderError(
      `The ${NAME} account changed during the sync. Nothing was uploaded; try again.`,
    );
  }

  const solves = [...byId].map(([id, v]) => ({
    id,
    title: v.title,
    url: `https://www.naukri.com/code360/problems/${encodeURIComponent(id)}`,
    difficulty: null,
    tags: [],
    solvedAt: v.solvedAt,
  }));
  if (!counts && solves.length === 0) {
    throw new ReaderError(`Could not read any solved problems from ${NAME}.`);
  }
  return buildPlatformUpload({
    platform: "code360",
    loggedInAs: uuid,
    counts,
    solves,
    listComplete: complete,
    activity: [],
  });
}

export const code360 = {
  id: "code360",
  name: NAME,
  origin: "https://www.naukri.com",
  homeUrl: "https://www.naukri.com/code360/",
  permissions: ["https://www.naukri.com/*"],
  /** @type {import("../job.js").PageCall[]} */
  identitySteps: [
    {
      fn: "readJsonField",
      args: [`${API}/v2/users/auth_details?naukri_request=true`, ["data", "uuid"]],
    },
  ],
  maxPages: MAX_PAGES,
  read,
};
