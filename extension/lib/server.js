// @ts-check
// Calls to the LogN server (not the platforms). Plain fetch; no `chrome`.
import { ReaderError } from "./common.js";

/** LogN rejected the token (revoked on Connect): this browser has to connect again. */
export class TokenRevokedError extends ReaderError {}

/**
 * @param {string} base
 * @param {string} token
 * @returns {Promise<{ username: string, leetcodeHandle: string | null, handles?: Record<string, { handle: string, verified: boolean, lastSyncedAt: string | number | null }> }>}
 */
export async function checkMe(base, token) {
  let res;
  try {
    res = await fetch(`${base}/api/extension/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ReaderError("Could not reach LogN.");
  }
  if (res.status === 401) {
    throw new TokenRevokedError("This browser was disconnected from LogN. Connect again.");
  }
  if (!res.ok) throw new ReaderError(`LogN returned HTTP ${res.status}.`);
  return await res.json();
}

/**
 * POSTs JSON with the token and returns the server's `{ ok: true, ... }` body.
 * @param {string} base
 * @param {string} token
 * @param {string} path  "/api/extension/platform" or "/api/extension/leetcode"
 * @param {unknown} body
 * @returns {Promise<any>}
 */
export async function postUpload(base, token, path, body) {
  /** @type {Response} */
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ReaderError("Could not reach LogN.");
  }
  if (res.status === 401) {
    throw new TokenRevokedError("This browser was disconnected from LogN. Connect again.");
  }
  /** @type {any} */
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new ReaderError(out.error || `LogN returned HTTP ${res.status}.`);
  return out;
}
