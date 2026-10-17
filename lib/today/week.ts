// The week strip and daily-goal progress on Today. Pure.

import type { ActivityDay } from "@/lib/dashboard/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_MS = 86_400_000;

export interface WeekDay {
  /** YYYY-MM-DD (UTC). */
  day: string;
  /** "Mon". */
  weekday: string;
  total: number;
  isToday: boolean;
}

/** The last 7 UTC days ending at `asOf` (YYYY-MM-DD), oldest first. */
export function weekStrip(activity: readonly ActivityDay[], asOf: string): WeekDay[] {
  const totals = new Map(activity.map((a) => [a.day, a.total]));
  const end = Date.parse(`${asOf}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(end - (6 - i) * DAY_MS);
    const day = date.toISOString().slice(0, 10);
    return {
      day,
      weekday: WEEKDAYS[date.getUTCDay()]!,
      total: totals.get(day) ?? 0,
      isToday: i === 6,
    };
  });
}

export interface GoalProgress {
  done: number;
  goal: number;
  /** 0 to 1. */
  fraction: number;
  met: boolean;
}

export function goalProgress(todayTotal: number, goal: number): GoalProgress {
  const done = Math.max(0, todayTotal);
  const fraction = goal > 0 ? Math.min(1, done / goal) : 1;
  return { done, goal, fraction, met: done >= goal };
}
