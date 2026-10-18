// @ts-check
// Sync jobs. Run in the service worker when the popup sends { type: "sync", platform }.
// LeetCode is fetched from here; the other five are read inside a tab of the platform's own site.
// Cookies stay in the browser: CodeLogs only receives handles, problem ids, titles, URLs,
// difficulty labels, dates and counts.
import { ReaderError } from "./lib/common.js";
import { normalizeBaseUrl } from "./lib/leetcode.js";
import { runLeetcodeJob } from "./lib/leetcode-job.js";
import { runPlatformJob } from "./lib/platform-job.js";
import { isSyncPlatform } from "./lib/registry.js";

const STATUS_KEY = "status";

/**
 * @typedef {{ state: "idle" | "running" | "done" | "error", platform: string | null, step: string, message: string, result: unknown, finishedAt: number | null }} Status
 */

let running = false;

/** @param {Partial<Status>} patch */
async function setStatus(patch) {
  const prev = /** @type {Status | undefined} */ (
    (await chrome.storage.session.get(STATUS_KEY))[STATUS_KEY]
  );
  /** @type {Status} */
  const base = prev ?? {
    state: "idle",
    platform: null,
    step: "",
    message: "",
    result: null,
    finishedAt: null,
  };
  // updatedAt lets the popup spot a job that died with the service worker.
  await chrome.storage.session.set({ [STATUS_KEY]: { ...base, ...patch, updatedAt: Date.now() } });
}

/**
 * @param {string} platform
 * @param {boolean} includeDates
 */
async function runSync(platform, includeDates) {
  const { baseUrl, token } = await chrome.storage.local.get(["baseUrl", "token"]);
  const base = normalizeBaseUrl(String(baseUrl ?? ""));
  if (!base || !token) throw new ReaderError("Save your CodeLogs URL and token first.");
  if (platform === "leetcode") return runLeetcodeJob({ base, token, includeDates, setStatus });
  return runPlatformJob({ platformId: platform, base, token, setStatus });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "sync") return false;
  const platform = msg.platform ?? "leetcode";
  if (running || !isSyncPlatform(platform)) {
    sendResponse({ started: false });
    return false;
  }
  running = true;
  sendResponse({ started: true });
  (async () => {
    await setStatus({
      state: "running",
      platform,
      step: "start",
      message: "Starting...",
      result: null,
      finishedAt: null,
    });
    try {
      const result = await runSync(platform, msg.includeDates !== false);
      await setStatus({
        state: "done",
        step: "done",
        message: "Done.",
        result,
        finishedAt: Date.now(),
      });
    } catch (e) {
      const message = e instanceof ReaderError ? e.message : "Unexpected error during sync.";
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
