// @ts-check
// When an automatic sync is due. Pure: no `chrome`, so the tests can drive it.

const HOUR_MS = 3_600_000;

/** A visit syncs a platform at most this often. */
export const VISIT_INTERVAL_MS = 6 * HOUR_MS;
/** LeetCode also syncs on a timer, this often. */
export const DAILY_INTERVAL_MS = 24 * HOUR_MS;
/** After a failed visit sync, wait this long before trying again on a visit. */
export const VISIT_RETRY_MS = 10 * 60_000;
/** After a logged-out visit sync the user is about to log in, so retry sooner. */
export const LOGGED_OUT_RETRY_MS = 60_000;
/** After a failed timer sync, wait this long (the timer fires hourly). */
export const DAILY_RETRY_MS = HOUR_MS;

/**
 * The last run of one platform, kept in chrome.storage.local under `runs`.
 * `at` is the last attempt and `okAt` the last success (epoch ms). `datesAt` is the last run whose
 * LeetCode date walk completed; absent in records from 0.3.3, which means "never". `skipped` is an
 * automatic run that left a removed platform alone (it counts as a success).
 * @typedef {{ at: number, okAt: number | null, datesAt?: number | null, ok: boolean, loggedOut: boolean, auto: boolean, text: string, skipped?: boolean }} RunRecord
 */

/**
 * An automatic sync leaves a platform the user removed on LogN alone: only a click on it in the
 * popup (`manual`) connects it again. The server enforces this too.
 * @param {{ handles?: Record<string, unknown>, removed?: string[] } | null | undefined} me  /api/extension/me
 * @param {string} platformId
 * @param {boolean} manual
 */
export function skipsRemoved(me, platformId, manual) {
  if (manual || me?.handles?.[platformId]) return false;
  return (me?.removed ?? []).includes(platformId);
}

/**
 * Due when the last success is older than `intervalMs` and the last attempt older than `retryMs`
 * (shortened to LOGGED_OUT_RETRY_MS when the last attempt found the user logged out).
 * @param {RunRecord | undefined} run
 * @param {number} now
 * @param {number} intervalMs
 * @param {number} retryMs
 */
export function isDue(run, now, intervalMs, retryMs) {
  if (!run) return true;
  if (run.okAt !== null && now - run.okAt < intervalMs) return false;
  return now - run.at >= (run.loggedOut ? Math.min(retryMs, LOGGED_OUT_RETRY_MS) : retryMs);
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
 * The record after a run. A failure keeps the previous success time, and a run whose date walk
 * didn't complete (`datesDone` false) keeps the previous `datesAt`.
 * @param {RunRecord | undefined} prev
 * @param {{ now: number, ok: boolean, loggedOut?: boolean, auto: boolean, text: string, datesDone?: boolean, skipped?: boolean }} r
 * @returns {RunRecord}
 */
export function nextRun(prev, r) {
  return {
    at: r.now,
    okAt: r.ok ? r.now : (prev?.okAt ?? null),
    datesAt: r.ok && r.datesDone ? r.now : (prev?.datesAt ?? null),
    ok: r.ok,
    loggedOut: r.loggedOut ?? false,
    auto: r.auto,
    text: r.text,
    skipped: r.skipped ?? false,
  };
}

/**
 * Where an automatic LeetCode date walk may stop (epoch seconds): a day before the last run whose
 * date walk completed, or null (walk everything) when there wasn't one.
 * @param {RunRecord | undefined} run
 */
export function leetcodeDatesSince(run) {
  if (!run?.datesAt) return null;
  return Math.floor((run.datesAt - DAILY_INTERVAL_MS) / 1000);
}
