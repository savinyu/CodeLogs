import { cn } from "cn";
import { HeatLegend, Heatmap } from "@/components/charts/heatmap";
import { Flame } from "@/components/kit/flame";
import { Panel } from "@/components/kit/panel";
import { SegmentedLinks } from "@/components/kit/segmented-links";
import type { ActivityPeriod } from "@/lib/dashboard/filters";
import { activeDaysSummary, periodRange } from "@/lib/dashboard/heatmap";
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

const days = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`;

/**
 * The Active days panel beside the Activity heatmap (Coach's .act-grid). Shared by Progress and the
 * public profile, so it only reads activity. Pass `periodLinks` for the owner's period switcher.
 */
export function ActivityRow({
  activity,
  asOf,
  period,
  periodLinks,
}: {
  activity: ActivityDay[];
  asOf: string;
  period: ActivityPeriod;
  periodLinks?: { href: string; label: string; active: boolean }[];
}) {
  const range = periodRange(period, asOf);
  const s = activeDaysSummary(activity, range, asOf);
  const pct = s.periodDays > 0 ? Math.round((s.activeDays / s.periodDays) * 100) : 0;
  const lit = activity.some((a) => a.day === asOf && a.total > 0);
  const streak = s.currentStreak;
  const streakLabel =
    streak === null
      ? ""
      : streak === 0
        ? "No current streak"
        : `Current streak: ${days(streak)}${lit ? "" : " (no activity yet today)"}`;

  return (
    <div className="grid gap-5 min-[1000px]:grid-cols-[13rem_minmax(0,1fr)]">
      <Panel aria-labelledby="active-days-title">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2
            id="active-days-title"
            className="font-display text-[1.3125rem] leading-tight font-semibold tracking-[-0.01em] whitespace-nowrap"
          >
            Active days
          </h2>
          {streak !== null ? (
            <span
              role="img"
              aria-label={streakLabel}
              title={streakLabel}
              className={cn(
                "inline-flex items-center gap-[3px] text-[0.9375rem] font-bold",
                lit ? "text-streak" : "text-muted-foreground",
              )}
            >
              <Flame size={20} lit={lit} />
              {streak.toLocaleString("en-US")}
            </span>
          ) : null}
        </div>
        <div className="font-display text-[2.75rem] leading-none font-bold">
          {s.activeDays.toLocaleString("en-US")}
        </div>
        <p className="mt-2 text-[0.906rem] text-muted-foreground">
          of {s.periodDays.toLocaleString("en-US")} days · {pct}%
        </p>
        <dl className="mt-[18px] grid gap-2 text-[0.906rem]">
          <Row label="Solves" value={s.total.toLocaleString("en-US")} />
          <Row label="Longest streak" value={days(s.longestStreak)} />
          {s.busiestWeekday !== null ? (
            <Row label="Most active" value={WEEKDAYS[s.busiestWeekday] ?? ""} />
          ) : null}
        </dl>
      </Panel>
      <Panel aria-labelledby="activity-title">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
          <h2
            id="activity-title"
            className="font-display text-2xl leading-tight font-semibold tracking-[-0.01em]"
          >
            Activity
          </h2>
          {periodLinks ? (
            <SegmentedLinks label="Heatmap period" items={periodLinks} onCard className="min-w-0" />
          ) : (
            <span className="text-sm text-muted-foreground">The last 12 months, in UTC</span>
          )}
        </div>
        <Heatmap activity={activity} asOf={asOf} period={period} />
        <div className="mt-2.5">
          <HeatLegend />
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 font-semibold">{value}</dd>
    </div>
  );
}
