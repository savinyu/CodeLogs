// @ts-check
import { normalizeBaseUrl } from "./lib/leetcode.js";
import { SYNC_PLATFORMS } from "./lib/registry.js";
import { describeLeetcodeResult, describePlatformResult } from "./lib/describe.js";

/** @typedef {{ handle: string, verified: boolean, lastSyncedAt: string | number | null }} HandleInfo */
/** @typedef {{ username: string, leetcodeHandle?: string | null, handles?: Record<string, HandleInfo> }} Me */

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
/** @type {any} */
let status = null;
let includeDates = true;
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
  el("connSummary").textContent = me ? `Connected as @${me.username}` : "Not connected";
}

function renderRows() {
  const list = el("platforms");
  list.replaceChildren();
  const running = isRunning();
  for (const p of SYNC_PLATFORMS) {
    const info = handleFor(p.id);
    const mine = running && status.platform === p.id;

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
    btn.disabled = running;
    btn.addEventListener("click", () => void startSync(p));
    row.append(btn);
    list.append(row);
  }
}

function renderResult() {
  const node = el("result");
  node.replaceChildren();
  node.classList.remove("error");
  if (!status || status.state === "idle" || status.state === "running") {
    if (status?.state === "running" && !isRunning()) {
      node.textContent = "The last sync was interrupted. Try again.";
      node.classList.add("error");
    }
    return;
  }
  const platform = SYNC_PLATFORMS.find((p) => p.id === status.platform);
  if (platform) node.append(h("span", "who", platform.name));
  if (status.state === "error") {
    node.classList.add("error");
    node.append(document.createTextNode(status.message));
  } else {
    node.append(
      document.createTextNode(
        status.platform === "leetcode"
          ? describeLeetcodeResult(status.result ?? {})
          : describePlatformResult(status.result ?? {}),
      ),
    );
  }
}

function render() {
  renderConnection();
  renderRows();
  renderResult();
}

// ---- Connection ----

async function save() {
  const base = normalizeBaseUrl(input("baseUrl").value);
  if (!base) {
    connOpen = true;
    render();
    show(el("conn"), "Use an https:// URL (or http://localhost).", "error");
    return null;
  }
  // Must run directly inside the click handler (user gesture). localhost is already granted.
  if (!base.startsWith("http://localhost")) {
    const granted = await chrome.permissions.request({ origins: [`${base}/*`] });
    if (!granted) {
      show(el("conn"), "Permission to contact that CodeLogs site was denied.", "error");
      return null;
    }
  }
  const token = input("token").value.trim();
  await chrome.storage.local.set({ baseUrl: base, token });
  input("baseUrl").value = base;
  show(el("conn"), "Saved.");
  return { base, token };
}

/**
 * Loads /api/extension/me and shows it. `silent` keeps quiet when nothing is set up yet.
 * @param {{ base: string, token: string }} conn
 * @param {boolean} silent
 */
async function refreshMe(conn, silent) {
  if (!silent) show(el("conn"), "Checking...");
  try {
    const res = await fetch(`${conn.base}/api/extension/me`, {
      headers: { Authorization: `Bearer ${conn.token}` },
    });
    if (res.status === 401) {
      me = null;
      connOpen = true;
      render();
      return show(el("conn"), "Token invalid or revoked.", "error");
    }
    if (!res.ok) return show(el("conn"), `CodeLogs returned HTTP ${res.status}.`, "error");
    me = await res.json();
    await chrome.storage.local.set({ meCache: me });
    if (!silent) {
      show(el("conn"), "Connected.", "ok");
      connOpen = false;
    }
    render();
  } catch {
    if (!silent) show(el("conn"), "Could not reach CodeLogs at that URL.", "error");
  }
}

async function check() {
  const saved = await save();
  if (!saved) return;
  if (!saved.token) return show(el("conn"), "Enter your token first.", "error");
  await refreshMe(saved, false);
}

// ---- Sync ----

/** @param {(typeof SYNC_PLATFORMS)[number]} p */
async function startSync(p) {
  show(el("conn"), "");
  // Host access for a platform is asked here, inside the click, the first time it is synced.
  if (p.kind === "page") {
    const granted = await chrome.permissions.request({ origins: p.permissions });
    if (!granted) {
      status = {
        state: "error",
        platform: p.id,
        message: `Allow access to ${p.name} to sync it. CodeLogs only reads your solved problems there.`,
      };
      return render();
    }
  }
  const s = await chrome.storage.local.get(["baseUrl", "token"]);
  if (!normalizeBaseUrl(String(s.baseUrl ?? "")) || !s.token) {
    connOpen = true;
    render();
    return show(el("conn"), "Save your CodeLogs URL and token first.", "error");
  }
  await chrome.runtime.sendMessage({ type: "sync", platform: p.id, includeDates });
}

/** @param {any} st */
function onStatus(st) {
  status = st;
  render();
  // A finished sync changes the handle row (verified, last synced): reload it from the server.
  if (st?.state === "done" && st.finishedAt && st.finishedAt !== refreshedFor) {
    refreshedFor = st.finishedAt;
    chrome.storage.local.get(["baseUrl", "token"]).then((s) => {
      const base = normalizeBaseUrl(String(s.baseUrl ?? ""));
      if (base && s.token) void refreshMe({ base, token: String(s.token) }, true);
    });
  }
}

// ---- Wiring ----

el("save").addEventListener("click", save);
el("check").addEventListener("click", check);
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

(async () => {
  const s = await chrome.storage.local.get([
    "baseUrl",
    "token",
    "includeDates",
    "theme",
    "meCache",
  ]);
  if (s.theme === "light" || s.theme === "dark") theme = s.theme;
  applyTheme();
  if (typeof s.baseUrl === "string") input("baseUrl").value = s.baseUrl;
  if (typeof s.token === "string") input("token").value = s.token;
  if (typeof s.includeDates === "boolean") includeDates = s.includeDates;
  if (s.meCache && typeof s.meCache.username === "string") {
    me = s.meCache;
    connOpen = false;
  }
  status = (await chrome.storage.session.get("status")).status ?? null;
  if (status?.state === "done") refreshedFor = status.finishedAt ?? null;
  render();

  const base = normalizeBaseUrl(String(s.baseUrl ?? ""));
  if (base && s.token) await refreshMe({ base, token: String(s.token) }, true);
})();
