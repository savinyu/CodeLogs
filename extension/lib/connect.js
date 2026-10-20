// @ts-check
// Links the extension to a CodeLogs account with no token to copy. The popup opens
// <CodeLogs>/extension/connect in a tab. Once that page shows a signed-in user, a script in the tab
// asks CodeLogs for a token with a same-origin request (the user's own session), and the token
// goes straight into chrome.storage. Signing in on that page (GitHub or Google) loads it again,
// which tries again. The marker attribute and event names mirror lib/extension.ts.

export const CONNECT_PATH = "/extension/connect";
const PENDING_KEY = "pendingConnect";
const PENDING_MAX_AGE_MS = 30 * 60_000;

/**
 * Runs inside the CodeLogs tab (self-contained, see inject.js). Waits for the page's marker; when
 * it says "ready", asks /api/extension/connect for a token.
 * @returns {Promise<{ state: "ok", token: string } | { state: "signed-out" | "missing" } | { state: "error", error: string }>}
 */
export async function connectInPage() {
  const ATTR = "data-codelogs-connect";
  try {
    sessionStorage.removeItem("codelogs:extension-connect");
  } catch {
    // storage blocked: the page still gets the event
  }
  /** @type {string | null} */
  let marker = null;
  for (let i = 0; i < 120 && !marker; i++) {
    marker = document.querySelector(`[${ATTR}]`)?.getAttribute(ATTR) ?? null;
    if (!marker) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (marker === "signed-out") return { state: "signed-out" };
  if (marker !== "ready") return { state: "missing" };
  try {
    const res = await fetch("/api/extension/connect", {
      method: "POST",
      credentials: "include",
      headers: { "X-CodeLogs-Extension": "connect" },
    });
    /** @type {any} */
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.ok && typeof out.token === "string") return { state: "ok", token: out.token };
    const error =
      typeof out.error === "string" ? out.error : `CodeLogs returned HTTP ${res.status}.`;
    return { state: "error", error };
  } catch {
    return { state: "error", error: "Could not reach CodeLogs." };
  }
}

/**
 * Runs inside the CodeLogs tab: tells the page how it went, "ok" or an error message. The page may
 * not have hydrated yet, so the result is also left in sessionStorage for it to read on mount.
 * @param {string} detail
 */
export function notifyConnectPage(detail) {
  try {
    sessionStorage.setItem("codelogs:extension-connect", detail);
  } catch {
    // storage blocked: the event alone has to do
  }
  document.dispatchEvent(new CustomEvent("codelogs:extension-connect", { detail }));
}

/**
 * Opens the connect page and remembers its tab, so its loads can be watched.
 * @param {string} base  normalized CodeLogs origin
 */
export async function startConnect(base) {
  const tab = await chrome.tabs.create({ url: `${base}${CONNECT_PATH}`, active: true });
  if (tab.id === undefined) return;
  await chrome.storage.session.set({ [PENDING_KEY]: { tabId: tab.id, base, at: Date.now() } });
}

/**
 * The pending connect for this tab, when the tab has just finished loading the connect page.
 * @param {number} tabId
 * @param {string | undefined} url
 * @returns {Promise<{ base: string } | null>}
 */
export async function pendingConnectFor(tabId, url) {
  const pending = (await chrome.storage.session.get(PENDING_KEY))[PENDING_KEY];
  if (!pending || pending.tabId !== tabId) return null;
  if (Date.now() - pending.at > PENDING_MAX_AGE_MS) {
    await clearPendingConnect();
    return null;
  }
  if (!url?.startsWith(`${pending.base}${CONNECT_PATH}`)) return null;
  return { base: pending.base };
}

export async function clearPendingConnect() {
  await chrome.storage.session.remove(PENDING_KEY);
}

/** @param {number} tabId */
export async function onTabClosed(tabId) {
  const pending = (await chrome.storage.session.get(PENDING_KEY))[PENDING_KEY];
  if (pending?.tabId === tabId) await clearPendingConnect();
}

/**
 * Asks for a token inside the connect tab. Null while the page shows the sign-in buttons (a sign-in
 * loads the page again, which calls this again).
 * @param {number} tabId
 * @returns {Promise<{ ok: true, token: string } | { ok: false, error: string } | null>}
 */
export async function connectInTab(tabId) {
  /** @type {any} */
  let res = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: connectInPage,
    });
    res = results[0]?.result ?? null;
  } catch {
    return { ok: false, error: "Could not read the CodeLogs tab. Click Connect again." };
  }
  if (res?.state === "signed-out") return null;
  if (res?.state === "ok") return { ok: true, token: res.token };
  if (res?.state === "error") return { ok: false, error: res.error };
  return { ok: false, error: "This CodeLogs site doesn't support connecting the extension." };
}

/**
 * @param {number} tabId
 * @param {string} detail  "ok" or an error message
 */
export async function notifyConnectTab(tabId, detail) {
  await chrome.scripting
    .executeScript({ target: { tabId }, func: notifyConnectPage, args: [detail] })
    .catch(() => {});
}
