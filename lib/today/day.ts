// Day check for Today's "mark done". Pure.

const DAY_MS = 86_400_000;

/**
 * True when `day` (YYYY-MM-DD) is a real date within one day of `nowMs`'s UTC day:
 * yesterday, today or tomorrow. Covers a page rendered from the cached clock.
 */
export function isWithinOneDay(day: string, nowMs: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) return false;
  const todayMs = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.abs(ms - todayMs) <= DAY_MS;
}
