// @ts-check
// LeetCode sync. Unlike the other platforms it runs its requests from the service worker (the
// browser sends the leetcode.com cookies because the extension has host access to it).
// Cookies stay in the browser: only problem slugs and timestamps go to CodeLogs.
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

/**
 * Walks /api/submissions/, newest first. Returns null if dates are unavailable. With `since`
 * (epoch seconds) it stops at the first page reaching back past it: CodeLogs keeps the dates it
 * already has, so an automatic sync only needs the submissions since the last one.
 * @param {number | null} since
 * @param {(n: number) => Promise<void>} onPage
 * @returns {Promise<Map<string, number> | null>}
 */
async function fetchDates(since, onPage) {
  const dates = new Map();
  let offset = 0;
  let lastKey = "";
  let backoff = 0;
  for (let page = 0; page < MAX_PAGES;) {
    const url = `https://leetcode.com/api/submissions/?offset=${offset}&limit=20&lastkey=${encodeURIComponent(lastKey)}`;
    let res;
    try {
      res = await fetch(url, { credentials: "include" });
    } catch {
      return null;
    }
    if (res.status === 429 || res.status === 403) {
      const wait = BACKOFF_MS[backoff++];
      if (wait === undefined) return null;
      await sleep(wait);
      continue;
    }
    if (!res.ok) return null;
    /** @type {any} */
    let json;
    try {
      json = await res.json();
    } catch {
      return null;
    }
    if (!json || !Array.isArray(json.submissions_dump)) return null;
    collectAcceptedDates([json], dates);
    page++;
    await onPage(page);
    if (json.has_next !== true) return dates;
    const oldest = oldestSubmissionTime(json);
    if (since !== null && oldest !== null && oldest < since) return dates;
    lastKey = typeof json.last_key === "string" ? json.last_key : "";
    offset += 20;
    await sleep(SUBMISSION_DELAY_MS);
  }
  return dates; // hit the page cap: keep what we have
}

/**
 * `datesSince` (epoch seconds) limits the date walk to recent submissions; null walks them all.
 * @param {{ base: string, token: string, includeDates: boolean, datesSince?: number | null, setStatus: (patch: Record<string, unknown>) => Promise<void> }} job
 */
export async function runLeetcodeJob({ base, token, includeDates, datesSince = null, setStatus }) {
  await setStatus({ step: "connect", message: "Checking your CodeLogs connection..." });
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
  if (includeDates) {
    await setStatus({ step: "dates", message: "Reading submission dates (page 0)..." });
    const got = await fetchDates(datesSince, (n) =>
      setStatus({ message: `Reading submission dates (page ${n})...` }),
    );
    if (got) dates = got;
    else datesNote = "Solve dates were unavailable, so they were not included.";
  }

  await setStatus({ step: "upload", message: "Uploading to CodeLogs..." });
  const body = buildUpload(parsed.userName, parsed.slugs, dates);
  if (body.solves.length === 0) {
    throw new ReaderError("No solved problems found on your LeetCode account.");
  }
  const out = await postUpload(base, token, "/api/extension/leetcode", body);
  return { ...out, datesNote };
}
