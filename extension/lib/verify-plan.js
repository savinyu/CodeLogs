// @ts-check
// The decision before a verify opens any tab. Pure, so the tests can drive it.
import { ReaderError } from "./common.js";

/**
 * What to do before opening a tab, from the `handles` of /api/extension/me.
 * @param {Record<string, { handle: string, verified: boolean }> | undefined} handles
 * @param {string} platformId
 * @param {string} name
 * @param {boolean} auto  automatic (a visit, or right after connecting) rather than a click
 * @returns {{ action: "read" } | { action: "done", result: { already?: boolean, notConnected?: boolean, handle?: string } }}
 */
export function planVerify(handles, platformId, name, auto) {
  const info = handles?.[platformId];
  if (!info) {
    if (auto) return { action: "done", result: { notConnected: true } };
    throw new ReaderError(`Add your ${name} handle on the CodeLogs Connect page first.`);
  }
  if (info.verified) return { action: "done", result: { already: true, handle: info.handle } };
  return { action: "read" };
}
