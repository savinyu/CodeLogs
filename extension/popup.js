// @ts-check
import { normalizeBaseUrl } from "./lib/leetcode.js";

/** @param {string} id @returns {HTMLInputElement} */
const input = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
/** @param {string} id @returns {HTMLElement} */
const el = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const syncBtn = /** @type {HTMLButtonElement} */ (el("sync"));

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

async function loadSettings() {
  const s = await chrome.storage.local.get(["baseUrl", "token", "includeDates"]);
  if (typeof s.baseUrl === "string") input("baseUrl").value = s.baseUrl;
  if (typeof s.token === "string") input("token").value = s.token;
  if (typeof s.includeDates === "boolean") input("dates").checked = s.includeDates;
}

async function save() {
  const base = normalizeBaseUrl(input("baseUrl").value);
  if (!base) {
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
  await chrome.storage.local.set({ baseUrl: base, token, includeDates: input("dates").checked });
  input("baseUrl").value = base;
  show(el("conn"), "Saved.");
  return { base, token };
}

async function check() {
  const saved = await save();
  if (!saved) return;
  if (!saved.token) return show(el("conn"), "Enter your token first.", "error");
  show(el("conn"), "Checking...");
  try {
    const res = await fetch(`${saved.base}/api/extension/me`, {
      headers: { Authorization: `Bearer ${saved.token}` },
    });
    if (res.status === 401) return show(el("conn"), "Token invalid or revoked.", "error");
    if (!res.ok) return show(el("conn"), `CodeLogs returned HTTP ${res.status}.`, "error");
    const me = await res.json();
    show(
      el("conn"),
      `Connected as @${me.username} · LeetCode: ${me.leetcodeHandle ?? "not connected"}`,
      "ok",
    );
  } catch {
    show(el("conn"), "Could not reach CodeLogs at that URL.", "error");
  }
}

/** @param {any} r */
function describe(r) {
  const parts = [`Imported ${r.imported} new`, `${r.alreadyKnown} already known`];
  if (r.skipped) parts.push(`${r.skipped} skipped`);
  if (typeof r.datesFilled === "number") parts.push(`dates filled for ${r.datesFilled}`);
  let text = `${parts.join(", ")}. ${r.complete ? "History complete." : "History incomplete."}`;
  if (r.datesNote) text += ` ${r.datesNote}`;
  return text;
}

const STALE_MS = 90_000;

/** @param {any} st */
function render(st) {
  if (!st || st.state === "idle") {
    syncBtn.disabled = false;
    show(el("status"), "");
    show(el("result"), "");
    return;
  }
  // The worker writes at least every ~20 s while running (the longest backoff); older means it
  // was stopped by Chrome mid-sync.
  if (st.state === "running" && Date.now() - (st.updatedAt ?? 0) > STALE_MS) {
    syncBtn.disabled = false;
    show(el("status"), "");
    show(el("result"), "The last sync was interrupted. Try again.", "error");
    return;
  }
  syncBtn.disabled = st.state === "running";
  if (st.state === "running") {
    show(el("status"), st.message);
    show(el("result"), "");
  } else if (st.state === "error") {
    show(el("status"), "");
    show(el("result"), st.message, "error");
  } else {
    show(el("status"), "");
    show(el("result"), describe(st.result), "ok");
  }
}

async function startSync() {
  const saved = await save();
  if (!saved) return;
  if (!saved.token) return show(el("conn"), "Enter your token first.", "error");
  syncBtn.disabled = true;
  await chrome.runtime.sendMessage({ type: "sync", includeDates: input("dates").checked });
}

el("save").addEventListener("click", save);
el("check").addEventListener("click", check);
syncBtn.addEventListener("click", startSync);
input("dates").addEventListener("change", () =>
  chrome.storage.local.set({ includeDates: input("dates").checked }),
);

chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.status) render(changes.status.newValue);
});

loadSettings().then(async () => {
  const { status } = await chrome.storage.session.get("status");
  render(status);
});
