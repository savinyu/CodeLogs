// @ts-check
// One-line summaries of a finished sync, shared by the popup and the tests.

/** @param {number} n @param {string} word */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * @param {{ handle?: string, created?: boolean, verified?: boolean, imported?: number, listed?: number, total?: number }} out  response of POST /api/extension/platform
 * @returns {string}
 */
export function describePlatformResult(out) {
  const listed = out.listed ?? 0;
  const total = out.total ?? 0;
  let text;
  if (listed > 0) text = `Synced ${plural(listed, "problem")} (${out.imported ?? 0} new).`;
  else if (total > 0) text = `Synced your solved count (${total}).`;
  else text = "Synced.";
  if (out.handle) {
    if (out.verified) text += ` Verified as @${out.handle}.`;
    else if (out.created) text += ` Connected @${out.handle}.`;
    else text += ` Not verified as @${out.handle}.`;
  }
  return text;
}

/**
 * @param {{ imported?: number, alreadyKnown?: number, skipped?: number, datesFilled?: number, complete?: boolean, datesNote?: string }} r  response of POST /api/extension/leetcode
 * @returns {string}
 */
export function describeLeetcodeResult(r) {
  const parts = [`Imported ${r.imported ?? 0} new`, `${r.alreadyKnown ?? 0} already known`];
  if (r.skipped) parts.push(`${r.skipped} skipped`);
  if (typeof r.datesFilled === "number") parts.push(`dates filled for ${r.datesFilled}`);
  let text = `${parts.join(", ")}. ${r.complete ? "History complete." : "History incomplete."}`;
  if (r.datesNote) text += ` ${r.datesNote}`;
  return text;
}
