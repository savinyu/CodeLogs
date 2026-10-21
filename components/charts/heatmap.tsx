import type { ActivityPeriod } from "@/lib/dashboard/filters";
import {
  activityStats,
  buildHeatmapGrid,
  periodRange,
  type HeatLevel,
} from "@/lib/dashboard/heatmap";
import type { ActivityDay } from "@/lib/dashboard/types";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 30;
const TOP = 18;

const FILL: Record<HeatLevel, string> = {
  0: "fill-heat-0",
  1: "fill-heat-1",
  2: "fill-heat-2",
  3: "fill-heat-3",
  4: "fill-heat-4",
};
const BG: Record<HeatLevel, string> = {
  0: "bg-heat-0",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
};

const WEEKDAY_LABELS: [number, string][] = [
  [1, "Mon"],
  [3, "Wed"],
  [5, "Fri"],
];

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

function tooltip(day: string, total: number, counts: ActivityDay["counts"]): string {
  if (total === 0) return `${formatDay(day)}: no activity`;
  const parts = PLATFORM_ORDER.flatMap((p) => {
    const n = counts[p] ?? 0;
    if (n <= 0) return [];
    const unit =
      p === "leetcode"
        ? n === 1
          ? "submission"
          : "submissions"
        : n === 1
          ? "new solve"
          : "new solves";
    return [`${PLATFORM_META[p].name} ${n} ${unit}`];
  });
  return `${formatDay(day)}: ${total} (${parts.join(", ")})`;
}

function periodLabel(period: ActivityPeriod): string {
  if (period === "last12") return "in the last 12 months";
  return `in ${period}`;
}

/** The activity heatmap as a server-rendered SVG (Coach's heatSVG). It brings its own sideways scroller. */
export function Heatmap({
  activity,
  asOf,
  period = "last12",
}: {
  activity: ActivityDay[];
  asOf: string;
  period?: ActivityPeriod;
}) {
  const range = periodRange(period, asOf);
  const { weeks, months } = buildHeatmapGrid(activity, range);
  const stats = activityStats(activity, range, asOf);
  const width = LEFT + weeks.length * STEP - GAP;
  const height = TOP + 7 * STEP - GAP;
  const when = periodLabel(period);
  const total = stats.total.toLocaleString("en-US");
  const days = `${stats.activeDays} active ${stats.activeDays === 1 ? "day" : "days"}`;
  const summary = `Activity heatmap ${when}: ${days}, ${total} ${stats.total === 1 ? "solve" : "solves"} and submissions, longest streak ${stats.longestStreak}`;

  return (
    // rtl starts the scroll at the right edge, so narrow screens show the latest weeks.
    <div
      dir="rtl"
      tabIndex={0}
      role="region"
      aria-label={`Activity heatmap ${when}, scrollable`}
      className="overflow-x-auto rounded-item pb-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div dir="ltr" className="w-max">
        <svg
          role="img"
          aria-label={summary}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-none"
        >
          {months.map((m) => (
            <text
              key={`${m.weekIndex}-${m.label}`}
              x={LEFT + m.weekIndex * STEP}
              y={11}
              fontSize={11}
              className="fill-muted-foreground"
            >
              {m.label}
            </text>
          ))}
          {WEEKDAY_LABELS.map(([row, label]) => (
            <text
              key={label}
              x={0}
              y={TOP + row * STEP + CELL - 3}
              fontSize={11}
              className="fill-muted-foreground"
            >
              {label}
            </text>
          ))}
          {weeks.map((week, w) =>
            week.map((cell, r) =>
              cell ? (
                <rect
                  key={cell.day}
                  x={LEFT + w * STEP}
                  y={TOP + r * STEP}
                  width={CELL}
                  height={CELL}
                  rx={3}
                  className={FILL[cell.level]}
                >
                  <title>{tooltip(cell.day, cell.total, cell.counts)}</title>
                </rect>
              ) : null,
            ),
          )}
        </svg>
      </div>
    </div>
  );
}

/** "Less [] [] [] [] [] More" (Coach's .legend). */
export function HeatLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground" aria-hidden>
      Less
      {([0, 1, 2, 3, 4] as const).map((l) => (
        <i key={l} className={`inline-block size-[13px] rounded-[4px] ${BG[l]}`} />
      ))}
      More
    </div>
  );
}
