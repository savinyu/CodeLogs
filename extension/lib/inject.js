// @ts-check
// Functions that `chrome.scripting.executeScript` runs INSIDE a platform's tab. Each one is
// serialized on its own, so it must not use anything from this module's scope (no helpers, no
// imports). Arguments and return values are plain JSON.
//
// The identity readers return one short string (a username or id) and nothing else: the
// responses they look at contain emails and access tokens, which must never leave the page.

/**
 * Same-origin request, made with the user's own session like the site's frontend does.
 * @param {{ url: string, method?: string, body?: string | null, headers?: Record<string, string>, as?: "json" | "text" }} req
 * @returns {Promise<{ status: number, data: unknown, error?: string }>}
 */
export async function fetchInPage(req) {
  try {
    /** @type {RequestInit} */
    const init = {
      method: req.method || "GET",
      credentials: "include",
      headers: req.headers || {},
    };
    if (req.body !== undefined && req.body !== null) init.body = req.body;
    const res = await fetch(req.url, init);
    if (req.as === "text") return { status: res.status, data: await res.text() };
    /** @type {unknown} */
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null, error: "network" };
  }
}

/**
 * Fetches JSON and returns only the string or number at `path`.
 * @param {string} url
 * @param {string[]} path
 * @returns {Promise<string | null>}
 */
export async function readJsonField(url, path) {
  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    /** @type {any} */
    let cur = await res.json();
    for (const key of path) {
      if (cur === null || typeof cur !== "object") return null;
      cur = cur[key];
    }
    if (typeof cur === "string" || typeof cur === "number") return String(cur).slice(0, 200);
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads one cookie by name from document.cookie (HttpOnly cookies are not visible here).
 * @param {string} name
 * @returns {string | null}
 */
export function readCookie(name) {
  try {
    for (const part of document.cookie.split(";")) {
      const i = part.indexOf("=");
      if (i < 0 || part.slice(0, i).trim() !== name) continue;
      const raw = part.slice(i + 1).trim();
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        value = raw;
      }
      return value === "" ? null : value.slice(0, 200);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reads a string or number from a page global (run with world "MAIN").
 * @param {string[]} path  starting at `window`
 * @returns {string | null}
 */
export function readGlobal(path) {
  try {
    /** @type {any} */
    let cur = window;
    for (const key of path) {
      if (cur === null || cur === undefined) return null;
      cur = cur[key];
    }
    if (typeof cur === "string" || typeof cur === "number") return String(cur).slice(0, 200);
    return null;
  } catch {
    return null;
  }
}

/**
 * Finds a profile link in the page header or nav and returns the handle in its first capture group.
 * @param {string} patternSource  RegExp source tested against the link's pathname
 * @returns {string | null}
 */
export function readLinkHandle(patternSource) {
  try {
    const re = new RegExp(patternSource);
    for (const a of document.querySelectorAll("header a[href], nav a[href]")) {
      const href = a.getAttribute("href");
      if (!href) continue;
      const m = re.exec(new URL(href, location.origin).pathname);
      if (m && m[1]) return decodeURIComponent(m[1]).slice(0, 200);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * HackerRank embeds its redux state in <script id="initialData"> (URL-encoded JSON); returns
 * the string at `path` in it.
 * @param {string[]} path
 * @returns {string | null}
 */
export function readInitialData(path) {
  try {
    const text = document.getElementById("initialData")?.textContent;
    if (!text) return null;
    /** @type {any} */
    let cur;
    try {
      cur = JSON.parse(text);
    } catch {
      cur = JSON.parse(decodeURIComponent(text));
    }
    for (const key of path) {
      if (cur === null || typeof cur !== "object") return null;
      cur = cur[key];
    }
    if (typeof cur === "string" || typeof cur === "number") return String(cur).slice(0, 200);
    return null;
  } catch {
    return null;
  }
}

/** The names a platform's identity steps and the job runner use. */
export const INJECTED = {
  fetchInPage,
  readJsonField,
  readCookie,
  readGlobal,
  readLinkHandle,
  readInitialData,
};
