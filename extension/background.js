// @ts-check
// Sync jobs, run in the service worker. A sync starts when:
//   - the popup sends { type: "sync", platform } (the Sync button) or { type: "verify", platform },
//   - the extension has just connected to LogN (every platform, once),
//   - the user loads a page on a platform whose last sync is older than 6 hours (that tab only),
//   - the hourly timer finds LeetCode's last sync older than a day.
// The automatic ones can be turned off in the popup. LeetCode is fetched from here; CodeChef,
// Code360, HackerRank, InterviewBit and GFG are read inside a tab of the platform's own site.
// Codeforces and AtCoder are not synced here (the server reads their public APIs): the extension
// only reads who the browser is logged in as, to verify the connected handle or connect it when
// none is connected yet. Cookies stay in the browser: LogN only receives handles, problem ids,
// titles, URLs, difficulty labels, dates and counts.
import { NotLoggedInError, ReaderError } from "./lib/common.js";
import {
  clearPendingConnect,
  connectInTab,
  notifyConnectTab,
  onTabClosed,
  pendingConnectFor,
  startConnect,
} from "./lib/connect.js";
import {
  describeLeetcodeResult,
  describePlatformResult,
  describeVerifyResult,
} from "./lib/describe.js";
import { basePermission, LOGN_ORIGIN, normalizeBaseUrl, OLD_ORIGIN } from "./lib/leetcode.js";
import { runLeetcodeJob } from "./lib/leetcode-job.js";
import { runPlatformJob } from "./lib/platform-job.js";
import { runVerifyJob } from "./lib/verify-job.js";
import {
  SYNC_PLATFORMS,
  VERIFY_PLATFORMS,
  isSyncPlatform,
  isVerifyPlatform,
} from "./lib/registry.js";
import {
  DAILY_INTERVAL_MS,
  DAILY_RETRY_MS,
  VISIT_INTERVAL_MS,
  VISIT_RETRY_MS,
  isDue,
  leetcodeDatesSince,
  nextRun,
  platformForUrl,
} from "./lib/schedule.js";
import { TokenRevokedError } from "./lib/server.js";

const STATUS_KEY = "status";
const RUNS_KEY = "runs";
const ALARM = "autosync";

/**
 * @typedef {{ state: "idle" | "running" | "done" | "error", platform: string | null, step: string, message: string, finishedAt: number | null }} Status
 * @typedef {import("./lib/schedule.js").RunRecord} RunRecord
 * @typedef {{ base: string, token: string, autoSync: boolean, includeDates: boolean }} Connection
 */

let running = false;
/** Connect tabs being read right now (a load can report "complete" twice). */
const connecting = new Set();

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
    finishedAt: null,
  };
  // updatedAt lets the popup spot a job that died with the service worker.
  await chrome.storage.session.set({ [STATUS_KEY]: { ...base, ...patch, updatedAt: Date.now() } });
}

/** @returns {Promise<Connection | null>} */
async function connection() {
  const s = await chrome.storage.local.get(["baseUrl", "token", "autoSync", "includeDates"]);
  const base = normalizeBaseUrl(String(s.baseUrl ?? ""));
  if (!base || typeof s.token !== "string" || !s.token) return null;
  return {
    base,
    token: s.token,
    autoSync: s.autoSync !== false,
    includeDates: s.includeDates !== false,
  };
}

/** @returns {Promise<Record<string, RunRecord>>} */
async function readRuns() {
  return (await chrome.storage.local.get(RUNS_KEY))[RUNS_KEY] ?? {};
}

/**
 * @param {string} platform
 * @param {{ ok: boolean, loggedOut?: boolean, auto: boolean, text: string }} r
 */
async function saveRun(platform, r) {
  const runs = await readRuns();
  runs[platform] = nextRun(runs[platform], { ...r, now: Date.now() });
  await chrome.storage.local.set({ [RUNS_KEY]: runs });
}

/** LogN rejected the token: forget it, so the popup offers Connect again. */
async function disconnect() {
  await chrome.storage.local.remove(["token", "meCache"]);
}

/**
 * Runs `job` unless another sync is running. Returns false when it didn't run.
 * @param {() => Promise<void>} job
 */
async function exclusive(job) {
  if (running) return false;
  running = true;
  try {
    await job();
  } finally {
    running = false;
  }
  return true;
}

/**
 * Syncs one platform and records the outcome under `runs`. Only a revoked token is thrown, since
 * nothing else can run without one.
 * @param {string} platform
 * @param {Connection} conn
 * @param {{ auto: boolean, tabId?: number, includeDates: boolean }} opts
 * @returns {Promise<{ ok: boolean, text: string }>}
 */
async function syncOne(platform, conn, opts) {
  await setStatus({
    state: "running",
    platform,
    step: "start",
    message: "Starting...",
    finishedAt: null,
  });
  try {
    let text;
    let datesDone = false;
    if (isVerifyPlatform(platform)) {
      const out = await runVerifyJob({
        platformId: platform,
        base: conn.base,
        token: conn.token,
        tabId: opts.tabId,
        setStatus,
      });
      text = describeVerifyResult(out);
    } else if (platform === "leetcode") {
      const runs = await readRuns();
      const out = await runLeetcodeJob({
        base: conn.base,
        token: conn.token,
        includeDates: opts.includeDates,
        datesSince: opts.auto ? leetcodeDatesSince(runs.leetcode) : null,
        setStatus,
      });
      text = describeLeetcodeResult(out);
      datesDone = out.datesDone;
    } else {
      const out = await runPlatformJob({
        platformId: platform,
        base: conn.base,
        token: conn.token,
        tabId: opts.tabId,
        setStatus,
      });
      text = describePlatformResult(out);
    }
    await saveRun(platform, { ok: true, auto: opts.auto, text, datesDone });
    return { ok: true, text };
  } catch (e) {
    if (e instanceof TokenRevokedError) {
      await disconnect();
      throw e;
    }
    const loggedOut = e instanceof NotLoggedInError;
    const text = e instanceof ReaderError ? e.message : "Unexpected error during sync.";
    await saveRun(platform, { ok: false, loggedOut, auto: opts.auto, text });
    return { ok: false, text };
  }
}

/**
 * Runs `work` as one job with the status around it.
 * @param {(conn: Connection) => Promise<void>} work
 */
async function runJob(work) {
  return exclusive(async () => {
    const conn = await connection();
    if (!conn) {
      await setStatus({
        state: "error",
        platform: null,
        message: "Connect to LogN first.",
        finishedAt: Date.now(),
      });
      return;
    }
    // Withheld by the user's site-access setting: every call to LogN would fail CORS.
    if (!(await chrome.permissions.contains({ origins: [basePermission(conn.base)] }))) {
      await setStatus({
        state: "error",
        platform: null,
        message: "LogN needs access to its own site. Click Sync and allow it.",
        finishedAt: Date.now(),
      });
      return;
    }
    try {
      await work(conn);
      await setStatus({ state: "done", step: "done", message: "", finishedAt: Date.now() });
    } catch (e) {
      const message = e instanceof ReaderError ? e.message : "Unexpected error during sync.";
      await setStatus({
        state: "error",
        step: "error",
        platform: null,
        message,
        finishedAt: Date.now(),
      });
    }
  });
}

/** After connecting: every platform once, opening background tabs where needed. */
function syncAll() {
  return runJob(async (conn) => {
    for (const p of SYNC_PLATFORMS) {
      // A platform whose host access was declined is synced by hand later (its Sync asks again).
      if (!(await chrome.permissions.contains({ origins: p.permissions }))) {
        continue;
      }
      await syncOne(p.id, conn, { auto: false, includeDates: conn.includeDates });
    }
    // Codeforces and AtCoder: connect or verify only (no tab is opened when already verified).
    for (const p of VERIFY_PLATFORMS) {
      if (!(await chrome.permissions.contains({ origins: p.permissions }))) continue;
      await syncOne(p.id, conn, { auto: true, includeDates: false });
    }
  });
}

// ---- Connect ----

/**
 * @param {number} tabId
 * @param {string} base
 */
async function finishConnect(tabId, base) {
  if (connecting.has(tabId)) return;
  connecting.add(tabId);
  try {
    const res = await connectInTab(tabId);
    if (res === null) return; // the page asks the user to sign in; its next load tries again
    await clearPendingConnect();
    if (!res.ok) {
      await notifyConnectTab(tabId, res.error);
      await setStatus({
        state: "error",
        platform: null,
        message: res.error,
        finishedAt: Date.now(),
      });
      return;
    }
    await chrome.storage.local.set({ baseUrl: base, token: res.token, [RUNS_KEY]: {} });
    await chrome.storage.local.remove("meCache");
    await notifyConnectTab(tabId, "ok");
    await syncAll();
  } finally {
    connecting.delete(tabId);
  }
}

// ---- Automatic sync ----

/**
 * A page finished loading: sync its platform in that tab if it's due.
 * @param {number} tabId
 * @param {string} url
 */
async function onVisit(tabId, url) {
  const p = platformForUrl(url, [...SYNC_PLATFORMS, ...VERIFY_PLATFORMS]);
  if (!p || running) return;
  const conn = await connection();
  if (!conn?.autoSync) return;
  if (!isDue((await readRuns())[p.id], Date.now(), VISIT_INTERVAL_MS, VISIT_RETRY_MS)) return;
  if (!(await chrome.permissions.contains({ origins: p.permissions }))) return;
  await runJob((c) =>
    syncOne(p.id, c, {
      auto: true,
      tabId: p.kind === "leetcode" ? undefined : tabId,
      includeDates: c.includeDates,
    }).then(() => {}),
  );
}

async function onAlarm() {
  if (running) return;
  const conn = await connection();
  if (!conn?.autoSync) return;
  if (!isDue((await readRuns()).leetcode, Date.now(), DAILY_INTERVAL_MS, DAILY_RETRY_MS)) return;
  await runJob((c) =>
    syncOne("leetcode", c, { auto: true, includeDates: c.includeDates }).then(() => {}),
  );
}

async function ensureAlarm() {
  if (!(await chrome.alarms.get(ALARM))) {
    await chrome.alarms.create(ALARM, { periodInMinutes: 60, delayInMinutes: 1 });
  }
}

// ---- Wiring (top level, so events wake the service worker) ----

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "connect") {
    const base = normalizeBaseUrl(String(msg.base ?? ""));
    if (base) void startConnect(base);
    sendResponse({ started: Boolean(base) });
    return false;
  }
  if (msg?.type !== "sync" && msg?.type !== "verify") return false;
  const platform = msg.platform ?? "leetcode";
  const known = msg.type === "verify" ? isVerifyPlatform(platform) : isSyncPlatform(platform);
  if (running || !known) {
    sendResponse({ started: false });
    return false;
  }
  sendResponse({ started: true });
  void runJob(async (conn) => {
    await syncOne(platform, conn, { auto: false, includeDates: msg.includeDates !== false });
  });
  return false;
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  // tab.url is only visible for sites the extension has host access to.
  if (info.status !== "complete" || !tab.url) return;
  const url = tab.url;
  void (async () => {
    const pending = await pendingConnectFor(tabId, url);
    if (pending) return finishConnect(tabId, pending.base);
    return onVisit(tabId, url);
  })();
});

chrome.tabs.onRemoved.addListener((tabId) => void onTabClosed(tabId));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void onAlarm();
});

void ensureAlarm();

// A service worker restart loses `running`; a stale "running" status must not stick.
chrome.runtime.onStartup.addListener(() => setStatus({ state: "idle", message: "" }));
chrome.runtime.onInstalled.addListener((details) => {
  void setStatus({ state: "idle", message: "" });
  // First install: the popup in a tab, as a welcome page with the Connect button.
  if (details.reason === "install") {
    void chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?tab") });
  }
  if (details.reason === "update") void moveOffOldOrigin();
});

/** 0.3.x saved the pre-rename URL: point it at LogN. Same database, so the token still works. */
async function moveOffOldOrigin() {
  const { baseUrl } = await chrome.storage.local.get("baseUrl");
  if (normalizeBaseUrl(String(baseUrl ?? "")) === OLD_ORIGIN) {
    await chrome.storage.local.set({ baseUrl: LOGN_ORIGIN });
  }
}
