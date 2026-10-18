// @ts-check
// GeeksforGeeks. Identity is the `gfguserName` cookie (a handle, not a secret) or the profile link
// in the header. The data comes from the two endpoints the site's own profile page calls:
//   POST practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/  (full solved list)
//   GET  authapi.geeksforgeeks.org/api-get/user-profile-info/             (total_problems_solved)
import {
  ReaderError,
  buildPlatformUpload,
  expectData,
  isRecord,
  istToEpoch,
  toCount,
} from "../common.js";

const NAME = "GeeksforGeeks";
const SUBMISSIONS_URL = "https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/";
const PROFILE_INFO_URL = "https://authapi.geeksforgeeks.org/api-get/user-profile-info/";

/**
 * "2025-03-18 00:30:33" is India time; returns epoch seconds.
 * @param {unknown} v
 * @returns {number | null}
 */
export function parseSubTime(v) {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v.trim());
  if (!m) return null;
  return istToEpoch(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
  );
}

/**
 * Parses the submissions response: buckets (School, Basic, Easy, Medium, Hard) of problems.
 * Keeps the earliest submission per slug.
 * @param {unknown} json
 * @returns {{ ok: true, solves: import("../common.js").UploadSolve[] } | { ok: false, error: string }}
 */
export function parseSubmissions(json) {
  if (!isRecord(json) || !isRecord(json.result)) {
    return { ok: false, error: `${NAME} sent an unexpected solved list.` };
  }
  /** @type {Map<string, import("../common.js").UploadSolve>} */
  const bySlug = new Map();
  for (const [bucket, problems] of Object.entries(json.result)) {
    if (!isRecord(problems)) continue;
    for (const p of Object.values(problems)) {
      if (!isRecord(p) || typeof p.slug !== "string" || p.slug === "") continue;
      const slug = p.slug;
      const solvedAt = parseSubTime(p.user_subtime);
      const prev = bySlug.get(slug);
      if (prev) {
        if (solvedAt !== null && (prev.solvedAt === null || solvedAt < prev.solvedAt)) {
          prev.solvedAt = solvedAt;
        }
        continue;
      }
      bySlug.set(slug, {
        id: slug,
        title: typeof p.pname === "string" && p.pname.trim() !== "" ? p.pname.trim() : slug,
        url: `https://www.geeksforgeeks.org/problems/${encodeURIComponent(slug)}`,
        difficulty: bucket,
        tags: [],
        solvedAt,
      });
    }
  }
  return { ok: true, solves: [...bySlug.values()] };
}

/**
 * @param {unknown} json
 * @returns {number | null} total_problems_solved
 */
export function parseProfileInfo(json) {
  if (!isRecord(json) || !isRecord(json.data)) return null;
  return toCount(json.data.total_problems_solved);
}

/**
 * @param {import("../job.js").ReaderContext} ctx
 * @returns {Promise<import("../common.js").PlatformUpload>}
 */
async function read(ctx) {
  const handle = await ctx.identity();
  if (!handle) throw new ReaderError(`Log in to ${NAME} in this browser, then try again.`);

  ctx.progress("Reading your solved list from GeeksforGeeks...");
  const res = await ctx.get(SUBMISSIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ handle, requestType: "", year: "", month: "" }),
  });
  const parsed = parseSubmissions(expectData(NAME, res, "your solved list"));
  if (!parsed.ok) throw new ReaderError(parsed.error);

  ctx.progress("Reading your GeeksforGeeks totals...");
  let total = null;
  try {
    const info = await ctx.get(
      `${PROFILE_INFO_URL}?handle=${encodeURIComponent(handle)}&article_count=false&redirect=true`,
    );
    if (info.status === 200) total = parseProfileInfo(info.data);
  } catch (e) {
    if (!(e instanceof ReaderError)) throw e;
    // The totals are optional; a failure here still leaves the list.
    total = null;
  }

  /** @type {Record<string, number>} */
  const byDifficulty = {};
  for (const s of parsed.solves) {
    const label = s.difficulty ?? "Unknown";
    byDifficulty[label] = (byDifficulty[label] ?? 0) + 1;
  }
  const listed = parsed.solves.length;
  return buildPlatformUpload({
    platform: "gfg",
    loggedInAs: handle,
    counts: { total: total ?? listed, byDifficulty },
    solves: parsed.solves,
    listComplete: total !== null && listed === total,
    activity: [],
  });
}

export const gfg = {
  id: "gfg",
  name: NAME,
  origin: "https://www.geeksforgeeks.org",
  homeUrl: "https://www.geeksforgeeks.org/",
  permissions: ["https://www.geeksforgeeks.org/*"],
  /** @type {import("../job.js").PageCall[]} */
  identitySteps: [
    { fn: "readCookie", args: ["gfguserName"] },
    { fn: "readLinkHandle", args: ["^/(?:profile|user)/([^/?#]+)"] },
  ],
  maxPages: 1,
  read,
};
