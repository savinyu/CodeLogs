// @ts-check
import { CODELOGS_ORIGIN, isAllowedBase, normalizeBaseUrl } from "./lib/leetcode.js";
import { SYNC_PLATFORMS } from "./lib/registry.js";

/** @typedef {{ handle: string, verified: boolean, lastSyncedAt: string | number | null }} HandleInfo */
/** @typedef {{ username: string, leetcodeHandle?: string | null, handles?: Record<string, HandleInfo> }} Me */
/** @typedef {import("./lib/schedule.js").RunRecord} RunRecord */

const STALE_MS = 90_000;

/** @param {string} id @returns {HTMLInputElement} */
const input = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
/** @param {string} id @returns {HTMLElement} */
const el = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * @param {HTMLElement} node
 * @param {string} text
 * @param {"" | "error" | "ok"} [kind]
 */
function show(node, text, kind = "") {
  node.textContent = text;
  node.classList.toggle("error", kind === "error");
  node.classList.toggle("ok", kind === "ok");
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
function h(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// ---- Theme: system -> light -> dark, stored in chrome.storage.local ----

const THEME_ICONS = {
  system:
    '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="3" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 16h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  light:
    '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3.5" fill="currentColor"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  dark: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M15 10.5A6.5 6.5 0 0 1 7.5 3a6.5 6.5 0 1 0 7.5 7.5Z" fill="currentColor"/></svg>',
};
/** @type {Record<string, "system" | "light" | "dark">} */
const NEXT_THEME = { system: "light", light: "dark", dark: "system" };
/** @type {"system" | "light" | "dark"} */
let theme = "system";

function applyTheme() {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  const btn = el("theme");
  btn.innerHTML = THEME_ICONS[theme];
  btn.setAttribute("aria-label", `Theme: ${theme}. Click to change.`);
  btn.title = `Theme: ${theme}. Click to change.`;
}

// ---- State ----

/** @type {Me | null} */
let me = null;
/** @type {{ base: string, token: string } | null} */
let conn = null;
/** @type {any} */
let status = null;
/** @type {Record<string, RunRecord>} */
let runs = {};
let includeDates = true;
let autoSync = true;
let connOpen = true;
/** @type {number | null} */
let refreshedFor = null;

/** @param {string | number | null | undefined} v @returns {string} */
function ago(v) {
  if (v === null || v === undefined || v === "") return "never";
  const ms = typeof v === "number" ? (v < 1e11 ? v * 1000 : v) : Date.parse(v);
  if (!Number.isFinite(ms)) return "never";
  const diff = (ms - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  /** @type {Array<[Intl.RelativeTimeFormatUnit, number]>} */
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "just now";
}

/** @param {string} id @returns {HandleInfo | null} */
function handleFor(id) {
  if (!me) return null;
  const h = me.handles?.[id];
  if (h) return h;
  if (id === "leetcode" && me.leetcodeHandle) {
    return { handle: me.leetcodeHandle, verified: false, lastSyncedAt: null };
  }
  return null;
}

function isRunning() {
  if (!status || status.state !== "running") return false;
  return Date.now() - (status.updatedAt ?? 0) <= STALE_MS;
}

// ---- Rendering ----

function renderConnection() {
  const body = el("connBody");
  body.hidden = !connOpen;
  el("connHead").setAttribute("aria-expanded", String(connOpen));
  el("connectView").hidden = conn !== null;
  el("connectedView").hidden = conn === null;
  input("autoSync").checked = autoSync;
  el("connSummary").textContent = !conn
    ? "Not connected"
    : me
      ? `Connected as @${me.username}`
      : "Connected";
}

/** The last run's outcome under a row: green when it worked, quiet when logged out, red otherwise. */
function lastRunLine(/** @type {RunRecord} */ run, /** @type {string} */ name) {
  if (run.ok) return h("div", "last", run.text);
  if (run.loggedOut) return h("div", "last quiet", `Not logged in to ${name} in this browser.`);
  return h("div", "last error", run.text);
}

function renderRows() {
  const list = el("platforms");
  list.replaceChildren();
  const running = isRunning();
  for (const p of SYNC_PLATFORMS) {
    const info = handleFor(p.id);
    const mine = running && status.platform === p.id;
    const run = runs[p.id];

    const row = h("li", "row");
    row.dataset.platform = p.id;
    row.append(h("span", `dot ${p.id}`));

    const body = h("div", "info");
    body.append(h("div", "name", p.name));
    const meta = h("div", "meta");
    if (info) {
      meta.append(
        h("span", info.verified ? "chip good" : "chip", info.verified ? "Verified" : "Unverified"),
        h("span", "handle", `@${info.handle}`),
        h("span", "", info.lastSyncedAt ? `Synced ${ago(info.lastSyncedAt)}` : "Never synced"),
      );
    } else {
      meta.append(h("span", "chip", "Not connected"));
    }
    body.append(meta);
    if (mine) body.append(h("div", "step", status.message));
    else if (run) body.append(lastRunLine(run, p.name));
    if (p.id === "leetcode") {
      const label = h("label", "check");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = includeDates;
      box.addEventListener("change", () => {
        includeDates = box.checked;
        chrome.storage.local.set({ includeDates });
      });
      label.append(box, document.createTextNode("Include solve dates (slower)"));
      body.append(label);
    }
    row.append(body);

    const btn = /** @type {HTMLButtonElement} */ (h("button", "btn sm", mine ? "Syncing" : "Sync"));
    btn.type = "button";
    btn.disabled = running || !conn;
    btn.addEventListener("click", () => void startSync(p));
    row.append(btn);
    list.append(row);
  }
}

/** Messages that aren't about one platform: a revoked token, a failed connect, a dead job. */
function renderResult() {
  const node = el("result");
  node.replaceChildren();
  node.classList.remove("error");
  if (status?.state === "running" && !isRunning()) {
    node.textContent = "The last sync was interrupted. Try again.";
    node.classList.add("error");
  } else if (status?.state === "error" && status.platform === null && status.message) {
    node.textContent = status.message;
    node.classList.add("error");
  }
}

function render() {
  renderConnection();
  renderRows();
  renderResult();
}

// ---- Connection ----

async function connect() {
  const base = normalizeBaseUrl(input("baseUrl").value);
  if (!base || !isAllowedBase(base)) {
    show(el("conn"), `Use ${CODELOGS_ORIGIN} (or http://localhost).`, "error");
    return;
  }
  // Inside the click (a user gesture), one prompt asks for every platform, plus localhost for a dev
  // server (the hosted CodeLogs is always allowed). LeetCode is an install-time host permission, but
  // Chrome withholds it when the user limits the extension's site access; asking grants it again.
  const local = base.startsWith("http://localhost");
  const origins = [
    ...(local ? ["http://localhost/*"] : []),
    ...SYNC_PLATFORMS.flatMap((p) => p.permissions),
  ];
  const granted = await chrome.permissions.request({ origins });
  // Declining the platforms still connects; each one asks again on its first Sync.
  if (!granted && local) {
    show(el("conn"), "CodeLogs needs permission to contact localhost.", "error");
    return;
  }
  await chrome.storage.local.set({ baseUrl: base });
  await chrome.runtime.sendMessage({ type: "connect", base });
  show(el("conn"), "Finish in the CodeLogs tab. Sign in there if it asks.");
}

async function disconnect() {
  await chrome.storage.local.remove(["token", "meCache", "runs"]);
  show(
    el("conn"),
    "Disconnected. Revoke it under Connected browsers on the CodeLogs Connect page.",
  );
}

/**
 * Loads /api/extension/me and shows it. The service worker forgets a revoked token itself, but
 * a 401 here clears it too.
 * @param {{ base: string, token: string }} c
 */
async function refreshMe(c) {
  try {
    const res = await fetch(`${c.base}/api/extension/me`, {
      headers: { Authorization: `Bearer ${c.token}` },
    });
    if (res.status === 401) {
      await chrome.storage.local.remove(["token", "meCache"]);
      return show(
        el("conn"),
        "This browser was disconnected from CodeLogs. Connect again.",
        "error",
      );
    }
    if (!res.ok) return;
    me = await res.json();
    await chrome.storage.local.set({ meCache: me });
    render();
  } catch {
    // offline or CodeLogs down: keep the cached view
  }
}

// ---- Sync ----

/** @param {(typeof SYNC_PLATFORMS)[number]} p */
async function startSync(p) {
  show(el("conn"), "");
  // Host access for a platform is asked here, inside the click, if it wasn't granted at Connect
  // (or, for LeetCode, was withheld by the user's site-access setting).
  const granted = await chrome.permissions.request({ origins: p.permissions });
  if (!granted) {
    runs = {
      ...runs,
      [p.id]: {
        at: Date.now(),
        okAt: runs[p.id]?.okAt ?? null,
        ok: false,
        loggedOut: false,
        auto: false,
        text: `Allow access to ${p.name} to sync it. CodeLogs only reads your solved problems there.`,
      },
    };
    return render();
  }
  await chrome.runtime.sendMessage({ type: "sync", platform: p.id, includeDates });
}

/** @param {any} st */
function onStatus(st) {
  status = st;
  render();
  // A finished sync changes the handle rows (verified, last synced): reload them from the server.
  if (st?.state === "done" && st.finishedAt && st.finishedAt !== refreshedFor && conn) {
    refreshedFor = st.finishedAt;
    void refreshMe(conn);
  }
}

/** Reads the connection from storage; refreshes `me` when it changed. */
async function loadConnection() {
  const s = await chrome.storage.local.get(["baseUrl", "token", "meCache", "runs", "autoSync"]);
  const base = normalizeBaseUrl(String(s.baseUrl ?? ""));
  const next = base && typeof s.token === "string" && s.token ? { base, token: s.token } : null;
  const changed = next?.token !== conn?.token;
  conn = next;
  runs = s.runs ?? {};
  autoSync = s.autoSync !== false;
  me = conn && s.meCache && typeof s.meCache.username === "string" ? s.meCache : null;
  if (typeof s.baseUrl === "string") input("baseUrl").value = s.baseUrl;
  if (changed) connOpen = conn === null;
  render();
  if (changed && conn) await refreshMe(conn);
}

// ---- Wiring ----

el("connect").addEventListener("click", connect);
el("disconnect").addEventListener("click", disconnect);
input("autoSync").addEventListener("change", () => {
  autoSync = input("autoSync").checked;
  chrome.storage.local.set({ autoSync });
});
el("connHead").addEventListener("click", () => {
  connOpen = !connOpen;
  renderConnection();
});
el("theme").addEventListener("click", () => {
  theme = NEXT_THEME[theme] ?? "system";
  applyTheme();
  chrome.storage.local.set({ theme });
});

chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.status) onStatus(changes.status.newValue);
});
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.token || changes.runs || changes.baseUrl) void loadConnection();
});

(async () => {
  if (new URLSearchParams(location.search).has("tab")) document.body.classList.add("in-tab");
  const s = await chrome.storage.local.get(["includeDates", "theme"]);
  if (s.theme === "light" || s.theme === "dark") theme = s.theme;
  applyTheme();
  if (typeof s.includeDates === "boolean") includeDates = s.includeDates;
  status = (await chrome.storage.session.get("status")).status ?? null;
  if (status?.state === "done") refreshedFor = status.finishedAt ?? null;
  await loadConnection();
})();
