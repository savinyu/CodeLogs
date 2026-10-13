import { buildHeatmapGrid, activityStats, type HeatLevel } from "@/lib/dashboard/heatmap";
import type { ActivityDay } from "@/lib/dashboard/types";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 28;
const TOP = 16;

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
  return `${formatDay(day)}: ${total} — ${parts.join(", ")}`;
}

export function ActivityHeatmap({ activity, asOf }: { activity: ActivityDay[]; asOf: string }) {
  const { weeks, months } = buildHeatmapGrid(activity, asOf);
  const stats = activityStats(activity, asOf);
  const width = LEFT + weeks.length * STEP - GAP;
  const height = TOP + 7 * STEP - GAP;
  const summary = `${stats.activeDays} active days, ${stats.total.toLocaleString("en-US")} in the last year, current streak ${stats.currentStreak}, longest ${stats.longestStreak}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {activity.length === 0 ? (
          "No activity in the last year."
        ) : (
          <>
            {stats.activeDays} active days · {stats.total.toLocaleString("en-US")} in the last year
            · current streak {stats.currentStreak} · longest {stats.longestStreak}
          </>
        )}
      </p>
      {/* rtl starts the scroll at the right edge, so narrow screens show the latest weeks. */}
      <div dir="rtl" className="overflow-x-auto pb-1">
        <div dir="ltr" className="w-max">
          <svg
            role="img"
            aria-label={`Activity heatmap: ${summary}`}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block max-w-none"
          >
            {months.map((m) => (
              <text
                key={`${m.weekIndex}-${m.label}`}
                x={LEFT + m.weekIndex * STEP}
                y={9}
                fontSize={10}
                className="fill-muted-foreground"
              >
                {m.label}
              </text>
            ))}
            {WEEKDAY_LABELS.map(([row, label]) => (
              <text
                key={label}
                x={0}
                y={TOP + row * STEP + CELL - 2}
                fontSize={10}
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
                    rx={2}
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
      <div className="text-muted-foreground flex items-center gap-1 text-xs" aria-hidden="true">
        <span className="mr-1">Less</span>
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span key={l} className={`size-[11px] rounded-[2px] ${BG[l]}`} />
        ))}
        <span className="ml-1">More</span>
      </div>
    </div>
  );
}
