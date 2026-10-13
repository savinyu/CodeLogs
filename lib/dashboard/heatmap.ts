// Pure heatmap math: grid layout, intensity levels and streaks. All dates are UTC YYYY-MM-DD.

import type { ActivityPeriod } from "./filters";
import type { ActivityDay } from "./types";

const HEATMAP_WINDOW = 365;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  day: string;
  total: number;
  counts: ActivityDay["counts"];
  level: HeatLevel;
}

export interface MonthLabel {
  weekIndex: number;
  label: string;
}

export interface HeatmapGrid {
  /** Columns, Sunday first. Each has 7 slots; null = outside the window (not rendered). */
  weeks: (HeatCell | null)[][];
  months: MonthLabel[];
}

export interface ActivityStats {
  activeDays: number;
  total: number;
  /** null when the period doesn't include asOf (a past year). */
  currentStreak: number | null;
  longestStreak: number;
}

function shift(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive UTC day range, YYYY-MM-DD. */
export interface DayRange {
  start: string;
  end: string;
}

export function periodRange(period: ActivityPeriod, asOf: string): DayRange {
  const last12 = shift(asOf, -(HEATMAP_WINDOW - 1));
  if (period === "last12") return { start: last12, end: asOf };
  const yearEnd = `${period}-12-31`;
  return { start: `${period}-01-01`, end: yearEnd < asOf ? yearEnd : asOf };
}

function inRange(activity: ActivityDay[], range: DayRange): ActivityDay[] {
  return activity.filter((a) => a.day >= range.start && a.day <= range.end);
}

function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}

export interface HeatThresholds {
  /** Upper bounds (inclusive) of levels 1-3. Anything above b3, or equal to max, is level 4. */
  bounds: [number, number, number];
  max: number;
}

function quantile(sorted: number[], q: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

/** Quartiles of the nonzero daily totals, so the spread adapts to how much the user solves. */
export function heatThresholds(activity: ActivityDay[]): HeatThresholds {
  const totals = activity
    .map((a) => a.total)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);
  if (totals.length === 0) return { bounds: [0, 0, 0], max: 0 };
  return {
    bounds: [quantile(totals, 0.25), quantile(totals, 0.5), quantile(totals, 0.75)],
    max: totals[totals.length - 1] ?? 0,
  };
}

export function heatLevel(total: number, { bounds, max }: HeatThresholds): HeatLevel {
  if (total <= 0) return 0;
  if (total >= max) return 4;
  if (total <= bounds[0]) return 1;
  if (total <= bounds[1]) return 2;
  if (total <= bounds[2]) return 3;
  return 4;
}

export function buildHeatmapGrid(activity: ActivityDay[], range: DayRange): HeatmapGrid {
  const { start: windowStart, end: windowEnd } = range;
  // Past one year, January is labeled with its year so multi-year grids stay readable.
  const multiYear = shift(windowStart, HEATMAP_WINDOW) <= windowEnd;
  const gridStart = shift(windowStart, -weekday(windowStart));
  const inside = inRange(activity, range);
  const thresholds = heatThresholds(inside);
  const byDay = new Map(inside.map((a) => [a.day, a]));

  const weeks: (HeatCell | null)[][] = [];
  const months: MonthLabel[] = [];
  let lastLabelWeek = -Infinity;

  for (let start = gridStart, w = 0; start <= windowEnd; start = shift(start, 7), w++) {
    const col: (HeatCell | null)[] = [];
    for (let r = 0; r < 7; r++) {
      const day = shift(start, r);
      if (day < windowStart || day > windowEnd) {
        col.push(null);
        continue;
      }
      const a = byDay.get(day);
      const total = a?.total ?? 0;
      col.push({ day, total, counts: a?.counts ?? {}, level: heatLevel(total, thresholds) });
      if (day.endsWith("-01") && w - lastLabelWeek >= 3) {
        const month = Number(day.slice(5, 7));
        const label = multiYear && month === 1 ? day.slice(0, 4) : (MONTHS[month - 1] ?? "");
        months.push({ weekIndex: w, label });
        lastLabelWeek = w;
      }
    }
    weeks.push(col);
  }
  return { weeks, months };
}

/**
 * Totals and longest streak count only days inside `range`. The current streak is "right now"
 * (it may reach before range.start) and is null unless the range ends at asOf.
 */
export function activityStats(
  activity: ActivityDay[],
  range: DayRange,
  asOf: string,
): ActivityStats {
  const allActive = new Set<string>();
  for (const a of activity) if (a.total > 0) allActive.add(a.day);

  const active = new Set<string>();
  let total = 0;
  for (const a of inRange(activity, range)) {
    if (a.total > 0) {
      active.add(a.day);
      total += a.total;
    }
  }

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of [...active].sort()) {
    run = prev !== null && shift(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }

  let currentStreak: number | null = null;
  if (range.end === asOf) {
    // Today may not be over yet: an inactive asOf doesn't break the streak.
    let cursor = allActive.has(asOf) ? asOf : shift(asOf, -1);
    let current = 0;
    while (allActive.has(cursor)) {
      current++;
      cursor = shift(cursor, -1);
    }
    currentStreak = current;
  }

  return { activeDays: active.size, total, currentStreak, longestStreak: longest };
}
