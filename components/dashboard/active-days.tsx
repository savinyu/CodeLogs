import type { ActivityPeriod } from "@/lib/dashboard/filters";
import { activeDaysSummary, periodRange } from "@/lib/dashboard/heatmap";
import { PLATFORM_COLOR, type ActivityDay } from "@/lib/dashboard/types";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";

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

  const platforms = PLATFORM_ORDER.filter((p) => (s.byPlatform[p] ?? 0) > 0);
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
        {s.currentStreak !== null && <Row label="Current streak" value={days(s.currentStreak)} />}
        <Row label="Longest streak" value={days(s.longestStreak)} />
        {s.busiestWeekday !== null && (
          <Row label="Most active" value={WEEKDAYS[s.busiestWeekday] ?? ""} />
        )}
      </dl>
      {platforms.length > 1 && (
        <dl className="flex flex-col gap-1.5 border-t pt-3 text-sm">
          {platforms.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: PLATFORM_COLOR[p] }}
                  aria-hidden="true"
                />
                {PLATFORM_META[p].name}
              </dt>
              <dd className="tabular-nums">{s.byPlatform[p]}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
