// @ts-check
// Sync for CodeChef, Code360, HackerRank, InterviewBit and GeeksforGeeks. The service worker never
// fetches these sites itself: it finds (or opens) a tab on the platform's own origin and runs small
// functions inside it, so the requests are same-origin and use the user's own session.
import { NotLoggedInError, ReaderError, sleep, buildPlatformUpload } from "./common.js";
import { createContext } from "./job.js";
import { INJECTED } from "./inject.js";
import { READERS } from "./registry.js";
import { checkMe, postUpload } from "./server.js";

const TAB_LOAD_TIMEOUT_MS = 30_000;
const TAB_SETTLE_MS = 1500;

/** @param {number} tabId */
async function waitForComplete(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("timeout"));
    }, TAB_LOAD_TIMEOUT_MS);
    /** @param {number} id @param {chrome.tabs.TabChangeInfo} info */
    function listener(id, info) {
      if (id !== tabId || info.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(undefined);
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Runs `fn` with a tab on the platform's origin: an open one if there is one, otherwise a
 * background tab that is closed afterwards. An open tab that was loaded before the user logged
 * in still shows them logged out (InterviewBit's page globals are set at load), so a
 * NotLoggedInError there is retried once in a fresh tab.
 * @template T
 * @param {{ name: string, origin: string, homeUrl: string }} reader
 * @param {(tabId: number) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withPlatformTab(reader, fn) {
  const open = await chrome.tabs.query({ url: `${reader.origin}/*`, discarded: false });
  const existing = open.find((t) => t.id !== undefined && t.status === "complete") ?? open[0];
  if (existing?.id !== undefined) {
    try {
      return await fn(existing.id);
    } catch (e) {
      if (!(e instanceof NotLoggedInError)) throw e;
    }
  }
  return withFreshTab(reader, fn);
}

/**
 * Runs `fn` in a new background tab on the platform's home page, closed afterwards.
 * @template T
 * @param {{ name: string, origin: string, homeUrl: string }} reader
 * @param {(tabId: number) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withFreshTab(reader, fn) {
  const tab = await chrome.tabs.create({ url: reader.homeUrl, active: false });
  const tabId = tab.id;
  if (tabId === undefined) throw new ReaderError(`Could not open ${reader.name}.`);
  try {
    try {
      await waitForComplete(tabId);
    } catch {
      throw new ReaderError(`${reader.name} took too long to load. Try again.`);
    }
    const loaded = await chrome.tabs.get(tabId);
    if (loaded.url && new URL(loaded.url).origin !== reader.origin) {
      throw new ReaderError(
        `${reader.name} sent the tab to another site. Open ${reader.name}, log in, and try again.`,
      );
    }
    await sleep(TAB_SETTLE_MS); // let the page set its globals
    return await fn(tabId);
  } finally {
    await chrome.tabs.remove(tabId).catch(() => {});
  }
}

/**
 * @param {number} tabId
 * @returns {(call: import("./job.js").PageCall) => Promise<unknown>}
 */
export function pageRunner(tabId) {
  return async (call) => {
    const func = /** @type {Record<string, (...args: any[]) => unknown>} */ (INJECTED)[call.fn];
    if (!func) throw new Error(`unknown page function ${call.fn}`);
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: call.world ?? "ISOLATED",
      func,
      args: call.args,
    });
    return results[0]?.result ?? null;
  };
}

/**
 * Runs `fn` in a tab the user already has open on the platform (automatic sync on a visit). It
 * never opens a tab of its own, and a logged-out tab stays a NotLoggedInError.
 * @template T
 * @param {{ name: string, origin: string }} reader
 * @param {number} tabId
 * @param {(tabId: number) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withVisitedTab(reader, tabId, fn) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.url || new URL(tab.url).origin !== reader.origin) {
    throw new ReaderError(`The ${reader.name} tab was closed or left the site.`);
  }
  await sleep(TAB_SETTLE_MS); // let the page set its globals
  return fn(tabId);
}

/**
 * Without `tabId` it uses an open tab or a background one (a sync the user asked for); with it,
 * only that tab (an automatic sync while the user is on the site).
 * @param {{ platformId: string, base: string, token: string, tabId?: number, setStatus: (patch: Record<string, unknown>) => Promise<void> }} job
 */
export async function runPlatformJob({ platformId, base, token, tabId, setStatus }) {
  const reader = /** @type {Record<string, (typeof READERS)[keyof typeof READERS]>} */ (READERS)[
    platformId
  ];
  if (!reader) throw new ReaderError("Unknown platform.");

  if (!(await chrome.permissions.contains({ origins: reader.permissions }))) {
    throw new ReaderError(
      `LogN needs permission to read ${reader.name}. Click Sync again and allow access.`,
    );
  }

  await setStatus({ step: "connect", message: "Checking your LogN connection..." });
  await checkMe(base, token);

  await setStatus({ step: "read", message: `Opening ${reader.name}...` });
  /** @param {number} id */
  const readIn = async (id) => {
    const ctx = createContext(reader, {
      runInPage: pageRunner(id),
      onProgress: (message) => void setStatus({ step: "read", message }),
    });
    return reader.read(ctx);
  };
  const upload =
    tabId === undefined
      ? await withPlatformTab(reader, readIn)
      : await withVisitedTab(reader, tabId, readIn);

  // Whatever a reader produced is cleaned once more before it leaves the browser.
  const body = buildPlatformUpload(upload);
  await setStatus({ step: "upload", message: "Uploading to LogN..." });
  return postUpload(base, token, "/api/extension/platform", body);
}
