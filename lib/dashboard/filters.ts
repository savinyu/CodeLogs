// Pure helpers for the dashboard's URL filters (?platform=, ?year=).

import type { AccountSummary, ActivityDay, PlatformFilter, PlatformTotal } from "./types";

/** "last12" = rolling 12 months ending at asOf; a number = calendar year (UTC). */
export type ActivityPeriod = "last12" | number;

/** Distinct years with activity, newest first. */
export function activityYears(activity: ActivityDay[]): number[] {
  const years = new Set<number>();
  for (const a of activity) {
    if (a.total > 0) years.add(Number(a.day.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

/** A year offered in `years` is used as-is; anything else falls back to the rolling view. */
export function parseActivityPeriod(value: unknown, years: number[]): ActivityPeriod {
  if (typeof value !== "string" || !/^\d{4}$/.test(value)) return "last12";
  const year = Number(value);
  return years.includes(year) ? year : "last12";
}

/** Builds a dashboard URL, omitting default filters. */
export function dashboardHref(
  pathname: string,
  q: { platform: PlatformFilter; period: ActivityPeriod },
): string {
  const params = new URLSearchParams();
  if (q.platform !== "all") params.set("platform", q.platform);
  if (q.period !== "last12") params.set("year", String(q.period));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * The platform tiles worth showing: a confirmed zero (synced, nothing solved) is hidden, while a
 * zero that is still pending or failing stays so its status chip is seen. A single-platform
 * filter always shows its tile.
 */
export function shownTotals(
  totals: PlatformTotal[],
  accounts: AccountSummary[],
  filter: PlatformFilter,
): PlatformTotal[] {
  if (filter !== "all") return totals;
  return totals.filter((t) => {
    if (t.solved > 0) return true;
    const status = accounts.find((a) => a.platform === t.platform)?.status;
    return status !== "ok" && status !== "partial";
  });
}
