import { cn } from "cn";
import { PlatformDot } from "@/components/kit/platform-dot";
import type { PlatformId } from "@/lib/adapters/types";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";

const FILL: Record<PlatformId, string> = {
  codeforces: "fill-platform-codeforces",
  atcoder: "fill-platform-atcoder",
  leetcode: "fill-platform-leetcode",
};

export interface StackedColumn {
  label: string;
  /** Shown in each segment's tooltip, such as "Nov 2025" or a band's rating ranges. */
  hint?: string;
  counts: Partial<Record<PlatformId, number>>;
}

// One viewBox for every chart, so two charts side by side come out the same height.
const W = 520;
const H = 240;
const PL = 34;
const PR = 6;
const PT = 20;
const PB = 26;

function gridStep(max: number): number {
  if (max <= 10) return 2;
  if (max <= 50) return 10;
  if (max <= 100) return 25;
  if (max <= 200) return 50;
  return 100;
}

const f = (n: number) => n.toFixed(1);

/** Stacked columns by platform, as a server-rendered SVG. `label` is the chart's accessible name. */
export function StackedColumns({ rows, label }: { rows: StackedColumn[]; label: string }) {
  const totals = rows.map((r) => PLATFORM_ORDER.reduce((n, p) => n + (r.counts[p] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const step = gridStep(max);
  const top = Math.ceil(max / step) * step;
  const ph = H - PT - PB;
  const bw = (W - PL - PR) / Math.max(rows.length, 1);
  const barW = Math.min(bw * 0.62, 56);

  const gridlines: number[] = [];
  for (let v = 0; v <= top; v += step) gridlines.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
      {gridlines.map((v) => {
        const y = PT + (1 - v / top) * ph;
        return (
          <g key={v}>
            <line
              x1={PL}
              x2={W - PR}
              y1={y}
              y2={y}
              strokeWidth={1}
              strokeDasharray={v ? "3 3" : undefined}
              className="stroke-border"
            />
            <text
              x={PL - 6}
              y={y + 4}
              fontSize={11}
              textAnchor="end"
              className="fill-muted-foreground"
            >
              {v}
            </text>
          </g>
        );
      })}
      {rows.map((row, i) => {
        const cx = PL + i * bw + bw / 2;
        const x0 = cx - barW / 2;
        const x1 = cx + barW / 2;
        const platforms = PLATFORM_ORDER.filter((p) => (row.counts[p] ?? 0) > 0);
        let y0 = H - PB;
        return (
          <g key={`${row.label}-${i}`}>
            {platforms.map((p, j) => {
              const n = row.counts[p] ?? 0;
              const h = (n / top) * ph;
              y0 -= h;
              const yb = y0 + h;
              // Round only the top of the stack.
              const r = j === platforms.length - 1 ? Math.min(4, h) : 0;
              const d = `M${f(x0)} ${f(yb)}V${f(y0 + r)}Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)}H${f(x1 - r)}Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + r)}V${f(yb)}Z`;
              return (
                <path key={p} d={d} className={FILL[p]}>
                  <title>{`${row.label}${row.hint ? ` (${row.hint})` : ""}: ${PLATFORM_META[p].name} ${n}`}</title>
                </path>
              );
            })}
            <text
              x={cx}
              y={y0 - 6}
              fontSize={11}
              fontWeight={600}
              textAnchor="middle"
              className="fill-foreground"
            >
              {totals[i]}
            </text>
            <text
              x={cx}
              y={H - 8}
              fontSize={11}
              textAnchor="middle"
              className="fill-muted-foreground"
            >
              {row.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The platform key under a chart (Coach's .plat-legend). */
export function PlatformLegend({
  platforms = PLATFORM_ORDER,
  className,
}: {
  platforms?: PlatformId[];
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "m-0 mt-2.5 flex list-none flex-wrap justify-center gap-x-3.5 gap-y-1 p-0 text-sm text-muted-foreground",
        className,
      )}
    >
      {platforms.map((p) => (
        <li key={p} className="inline-flex items-center gap-1.5">
          <PlatformDot platform={p} />
          {PLATFORM_META[p].name}
        </li>
      ))}
    </ul>
  );
}
