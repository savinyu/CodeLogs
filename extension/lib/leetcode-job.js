// @ts-check
// LeetCode sync. Unlike the other platforms it runs its requests from the service worker (the
// browser sends the leetcode.com cookies because the extension has host access to it).
// Cookies stay in the browser: only problem slugs and timestamps go to LogN.
import { NotLoggedInError, ReaderError, sleep } from "./common.js";
import {
  parseProblemsAll,
  collectAcceptedDates,
  buildUpload,
  oldestSubmissionTime,
} from "./leetcode.js";
import { checkMe, postUpload } from "./server.js";

const SUBMISSION_DELAY_MS = 1500;
const BACKOFF_MS = [10_000, 20_000];
const MAX_PAGES = 400;
const LEETCODE_ORIGINS = ["https://leetcode.com/*"];

/**
 * Walks /api/submissions/, newest first. Returns null if nothing could be read. `complete` is
 * false when the walk ended early (throttled, a network or page error, or the page cap): the
 * dates read so far are still returned. With `since` (epoch seconds) it stops at the first page
 * reaching back past it: LogN keeps the dates it already has, so an automatic sync only needs
 * the submissions since the last one.
 * @param {number | null} since
 * @param {(n: number) => Promise<void>} onPage
 * @returns {Promise<{ dates: Map<string, number>, complete: boolean, capped: boolean } | null>}
 */
async function fetchDates(since, onPage) {
  const dates = new Map();
  let offset = 0;
  let lastKey = "";
  let backoff = 0;
  let page = 0;
  /** An early end keeps what was read, unless nothing was. */
  const partial = () => (page > 0 ? { dates, complete: false, capped: false } : null);
  while (page < MAX_PAGES) {
    const url = `https://leetcode.com/api/submissions/?offset=${offset}&limit=20&lastkey=${encodeURIComponent(lastKey)}`;
    let res;
    try {
      res = await fetch(url, { credentials: "include" });
    } catch {
      return partial();
    }
    if (res.status === 429 || res.status === 403) {
      const wait = BACKOFF_MS[backoff++];
      if (wait === undefined) return partial();
      await sleep(wait);
      continue;
    }
    if (!res.ok) return partial();
    /** @type {any} */
    let json;
    try {
      json = await res.json();
    } catch {
      return partial();
    }
    if (!json || !Array.isArray(json.submissions_dump)) return partial();
    backoff = 0; // the budget is per throttle, not per walk
    collectAcceptedDates([json], dates);
    page++;
    await onPage(page);
    if (json.has_next !== true) return { dates, complete: true, capped: false };
    const oldest = oldestSubmissionTime(json);
    if (since !== null && oldest !== null && oldest < since) {
      return { dates, complete: true, capped: false };
    }
    lastKey = typeof json.last_key === "string" ? json.last_key : "";
    offset += 20;
    await sleep(SUBMISSION_DELAY_MS);
  }
  return { dates, complete: false, capped: true }; // hit the page cap: keep what we have
}

/**
 * `datesSince` (epoch seconds) limits the date walk to recent submissions; null walks them all.
 * @param {{ base: string, token: string, includeDates: boolean, datesSince?: number | null, setStatus: (patch: Record<string, unknown>) => Promise<void> }} job
 */
export async function runLeetcodeJob({ base, token, includeDates, datesSince = null, setStatus }) {
  // Without host access (withheld by the user's site-access setting) the fetches below fail CORS.
  if (!(await chrome.permissions.contains({ origins: LEETCODE_ORIGINS }))) {
    throw new ReaderError(
      "LogN needs permission to read LeetCode. Click Sync again and allow access.",
    );
  }

  await setStatus({ step: "connect", message: "Checking your LogN connection..." });
  await checkMe(base, token);

  await setStatus({ step: "solved", message: "Reading your solved list from LeetCode..." });
  let res;
  try {
    res = await fetch("https://leetcode.com/api/problems/all/", { credentials: "include" });
  } catch {
    throw new ReaderError("Could not reach leetcode.com.");
  }
  if (!res.ok) throw new ReaderError(`leetcode.com returned HTTP ${res.status}.`);
  const parsed = parseProblemsAll(await res.json().catch(() => null));
  if (!parsed.ok) {
    throw parsed.loggedOut ? new NotLoggedInError(parsed.error) : new ReaderError(parsed.error);
  }

  /** @type {Map<string, number>} */
  let dates = new Map();
  let datesNote = "";
  let datesDone = false;
  if (includeDates) {
    // The problem list was just fetched; don't open the submissions walk right behind it.
    await sleep(SUBMISSION_DELAY_MS);
    await setStatus({ step: "dates", message: "Reading submission dates (page 0)..." });
    const got = await fetchDates(datesSince, (n) =>
      setStatus({ message: `Reading submission dates (page ${n})...` }),
    );
    if (got) {
      dates = got.dates;
      datesDone = got.complete;
      if (got.capped) {
        datesNote = `Stopped reading solve dates after ${MAX_PAGES} pages, so older solves may have no date.`;
      } else if (!got.complete) {
        datesNote = "Reading solve dates stopped early, so some solves may have no date.";
      }
    } else datesNote = "Solve dates were unavailable, so they were not included.";
  }

  await setStatus({ step: "upload", message: "Uploading to LogN..." });
  const body = buildUpload(parsed.userName, parsed.slugs, dates);
  if (body.solves.length === 0) {
    throw new ReaderError("No solved problems found on your LeetCode account.");
  }
  const out = await postUpload(base, token, "/api/extension/leetcode", body);
  return { ...out, datesNote, datesDone };
}
