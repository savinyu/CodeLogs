// Pure helpers for the dashboard's URL filters (?platform=, ?year=).

import type { ActivityDay, PlatformFilter } from "./types";

/**
 * "last12" = rolling 12 months ending at asOf; "all" = first activity to asOf;
 * a number = calendar year (UTC).
 */
export type ActivityPeriod = "last12" | "all" | number;

/** Distinct years with activity, newest first. */
export function activityYears(activity: ActivityDay[]): number[] {
  const years = new Set<number>();
  for (const a of activity) {
    if (a.total > 0) years.add(Number(a.day.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

/** "all" or a year offered in `years` is used as-is; anything else falls back to the rolling view. */
export function parseActivityPeriod(value: unknown, years: number[]): ActivityPeriod {
  if (value === "all") return "all";
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
