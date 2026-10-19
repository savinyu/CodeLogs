// @ts-check
// When an automatic sync is due. Pure: no `chrome`, so the tests can drive it.

const HOUR_MS = 3_600_000;

/** A visit syncs a platform at most this often. */
export const VISIT_INTERVAL_MS = 6 * HOUR_MS;
/** LeetCode also syncs on a timer, this often. */
export const DAILY_INTERVAL_MS = 24 * HOUR_MS;
/** After a failed or logged-out visit sync, wait this long before trying again on a visit. */
export const VISIT_RETRY_MS = 10 * 60_000;
/** After a failed timer sync, wait this long (the timer fires hourly). */
export const DAILY_RETRY_MS = HOUR_MS;

/**
 * The last run of one platform, kept in chrome.storage.local under `runs`.
 * `at` is the last attempt and `okAt` the last success (epoch ms).
 * @typedef {{ at: number, okAt: number | null, ok: boolean, loggedOut: boolean, auto: boolean, text: string }} RunRecord
 */

/**
 * Due when the last success is older than `intervalMs` and the last attempt older than `retryMs`.
 * @param {RunRecord | undefined} run
 * @param {number} now
 * @param {number} intervalMs
 * @param {number} retryMs
 */
export function isDue(run, now, intervalMs, retryMs) {
  if (!run) return true;
  if (run.okAt !== null && now - run.okAt < intervalMs) return false;
  return now - run.at >= retryMs;
}

/**
 * The platform a page URL belongs to, by its `visitPrefix`, or null.
 * @template {{ id: string, visitPrefix: string }} P
 * @param {string | undefined} url
 * @param {readonly P[]} platforms
 * @returns {P | null}
 */
export function platformForUrl(url, platforms) {
  if (!url) return null;
  return platforms.find((p) => url.startsWith(p.visitPrefix)) ?? null;
}

/**
 * The record after a run. A failure keeps the previous success time.
 * @param {RunRecord | undefined} prev
 * @param {{ now: number, ok: boolean, loggedOut?: boolean, auto: boolean, text: string }} r
 * @returns {RunRecord}
 */
export function nextRun(prev, r) {
  return {
    at: r.now,
    okAt: r.ok ? r.now : (prev?.okAt ?? null),
    ok: r.ok,
    loggedOut: r.loggedOut ?? false,
    auto: r.auto,
    text: r.text,
  };
}

/**
 * Where an automatic LeetCode date walk may stop (epoch seconds): a day before the last success,
 * or null (walk everything) when there wasn't one.
 * @param {RunRecord | undefined} run
 */
export function leetcodeDatesSince(run) {
  if (!run?.okAt) return null;
  return Math.floor((run.okAt - DAILY_INTERVAL_MS) / 1000);
}
