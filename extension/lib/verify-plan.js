// @ts-check
// The decision before a verify opens any tab. Pure, so the tests can drive it.

/**
 * What to do before opening a tab, from the `handles` of /api/extension/me. A handle that isn't
 * connected yet is read too: LogN then connects the logged-in user.
 * @param {Record<string, { handle: string, verified: boolean }> | undefined} handles
 * @param {string} platformId
 * @returns {{ action: "read" } | { action: "done", result: { already: true, handle: string } }}
 */
export function planVerify(handles, platformId) {
  const info = handles?.[platformId];
  if (info?.verified) return { action: "done", result: { already: true, handle: info.handle } };
  return { action: "read" };
}
