// @ts-check
// Sync job. Runs in the service worker when the popup sends { type: "sync" }.
// Cookies stay in the browser: we only POST problem slugs and timestamps to CodeLogs.
import {
  parseProblemsAll,
  collectAcceptedDates,
  buildUpload,
  normalizeBaseUrl,
} from "./lib/leetcode.js";

const STATUS_KEY = "status";
const SUBMISSION_DELAY_MS = 1500;
const BACKOFF_MS = [10_000, 20_000];
const MAX_PAGES = 400;

/** @typedef {{ state: "idle" | "running" | "done" | "error", step: string, message: string, result: unknown, finishedAt: number | null }} Status */

let running = false;

/** @param {Partial<Status>} patch */
async function setStatus(patch) {
  const prev = /** @type {Status | undefined} */ (
    (await chrome.storage.session.get(STATUS_KEY))[STATUS_KEY]
  );
  /** @type {Status} */
  const base = prev ?? { state: "idle", step: "", message: "", result: null, finishedAt: null };
  // updatedAt lets the popup spot a job that died with the service worker.
  await chrome.storage.session.set({ [STATUS_KEY]: { ...base, ...patch, updatedAt: Date.now() } });
}

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class SyncError extends Error {}

/**
 * @param {string} base
 * @param {string} token
 */
async function checkMe(base, token) {
  const res = await fetch(`${base}/api/extension/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401)
    throw new SyncError("Token invalid or revoked. Create a new one in CodeLogs Settings.");
  if (!res.ok) throw new SyncError(`CodeLogs returned HTTP ${res.status}.`);
  return /** @type {{ username: string, leetcodeHandle: string | null }} */ (await res.json());
}

/**
 * Walks /api/submissions/. Returns null if dates are unavailable.
 * @param {(n: number) => Promise<void>} onPage
 * @returns {Promise<Map<string, number> | null>}
 */
async function fetchDates(onPage) {
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
    lastKey = typeof json.last_key === "string" ? json.last_key : "";
    offset += 20;
    await sleep(SUBMISSION_DELAY_MS);
  }
  return dates; // hit the page cap: keep what we have
}

/** @param {boolean} includeDates */
async function runSync(includeDates) {
  const { baseUrl, token } = await chrome.storage.local.get(["baseUrl", "token"]);
  const base = normalizeBaseUrl(String(baseUrl ?? ""));
  if (!base || !token) throw new SyncError("Save your CodeLogs URL and token first.");

  await setStatus({ step: "connect", message: "Checking your CodeLogs token..." });
  await checkMe(base, token);

  await setStatus({ step: "solved", message: "Reading your solved list from LeetCode..." });
  let res;
  try {
    res = await fetch("https://leetcode.com/api/problems/all/", { credentials: "include" });
  } catch {
    throw new SyncError("Could not reach leetcode.com.");
  }
  if (!res.ok) throw new SyncError(`leetcode.com returned HTTP ${res.status}.`);
  const parsed = parseProblemsAll(await res.json().catch(() => null));
  if (!parsed.ok) throw new SyncError(parsed.error);

  /** @type {Map<string, number>} */
  let dates = new Map();
  let datesNote = "";
  if (includeDates) {
    await setStatus({ step: "dates", message: "Reading submission dates (page 0)..." });
    const got = await fetchDates((n) =>
      setStatus({ message: `Reading submission dates (page ${n})...` }),
    );
    if (got) dates = got;
    else datesNote = "Solve dates were unavailable, so they were not included.";
  }

  await setStatus({ step: "upload", message: "Uploading to CodeLogs..." });
  const body = buildUpload(parsed.userName, parsed.slugs, dates);
  if (body.solves.length === 0)
    throw new SyncError("No solved problems found on your LeetCode account.");
  /** @type {Response} */
  let up;
  try {
    up = await fetch(`${base}/api/extension/leetcode`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SyncError("Could not reach CodeLogs.");
  }
  /** @type {any} */
  const out = await up.json().catch(() => ({}));
  if (!up.ok || !out.ok) throw new SyncError(out.error || `CodeLogs returned HTTP ${up.status}.`);
  return { ...out, datesNote };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "sync") return false;
  if (running) {
    sendResponse({ started: false });
    return false;
  }
  running = true;
  sendResponse({ started: true });
  (async () => {
    await setStatus({
      state: "running",
      step: "start",
      message: "Starting...",
      result: null,
      finishedAt: null,
    });
    try {
      const result = await runSync(msg.includeDates !== false);
      await setStatus({
        state: "done",
        step: "done",
        message: "Done.",
        result,
        finishedAt: Date.now(),
      });
    } catch (e) {
      const message = e instanceof SyncError ? e.message : "Unexpected error during sync.";
      await setStatus({
        state: "error",
        step: "error",
        message,
        result: null,
        finishedAt: Date.now(),
      });
    } finally {
      running = false;
    }
  })();
  return false;
});

// A service worker restart loses `running`; a stale "running" status must not stick.
chrome.runtime.onStartup.addListener(() => setStatus({ state: "idle", message: "" }));
chrome.runtime.onInstalled.addListener(() => setStatus({ state: "idle", message: "" }));
