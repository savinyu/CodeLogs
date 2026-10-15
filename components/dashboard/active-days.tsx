import { Flame } from "lucide-react";
import { cn } from "cn";

import type { ActivityPeriod } from "@/lib/dashboard/filters";
import { activeDaysSummary, activityStats, periodRange } from "@/lib/dashboard/heatmap";
import type { ActivityDay } from "@/lib/dashboard/types";

const WEEKDAYS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * LeetCode-style streak: a flame and the current streak. The flame is orange once today (UTC) has
 * activity, and grey while the streak still waits on today. Renders nothing when the period
 * doesn't include today.
 */
export function StreakFlame({
  activity,
  asOf,
  period = "last12",
}: {
  activity: ActivityDay[];
  asOf: string;
  period?: ActivityPeriod;
}) {
  const range = periodRange(period, asOf);
  const { currentStreak } = activityStats(activity, range, asOf);
  if (currentStreak === null) return null;

  const lit = activity.some((a) => a.day === asOf && a.total > 0);
  const label =
    currentStreak === 0
      ? "No current streak"
      : `Current streak: ${days(currentStreak)}${lit ? "" : " (no activity yet today)"}`;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm font-semibold tabular-nums",
        lit ? "text-streak" : "text-muted-foreground",
      )}
      title={label}
      aria-label={label}
      role="img"
    >
      <Flame className={cn("size-5", lit && "fill-streak")} aria-hidden />
      <span>{currentStreak.toLocaleString("en-US")}</span>
    </div>
  );
}

export function ActiveDays({
  activity,
  asOf,
  period = "last12",
}: {
  activity: ActivityDay[];
  asOf: string;
  period?: ActivityPeriod;
}) {
  const s = activeDaysSummary(activity, periodRange(period, asOf), asOf);
  const label = period === "last12" ? "in the last year" : `in ${period}`;

  if (s.activeDays === 0) {
    return <p className="text-muted-foreground text-sm">No activity {label}.</p>;
  }

  const pct = Math.round((s.activeDays / s.periodDays) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-3xl font-semibold tabular-nums">
          {s.activeDays.toLocaleString("en-US")}
        </div>
        <p className="text-muted-foreground text-sm">
          of {s.periodDays.toLocaleString("en-US")} days · {pct}%
        </p>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        <Row label="Longest streak" value={days(s.longestStreak)} />
        {s.busiestWeekday !== null && (
          <Row label="Most active" value={WEEKDAYS[s.busiestWeekday] ?? ""} />
        )}
      </dl>
    </div>
  );
}
