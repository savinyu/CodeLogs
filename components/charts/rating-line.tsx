import type { PlatformId } from "@/lib/adapters/types";

export interface RatingPoint {
  /** ISO timestamp. */
  at: string;
  rating: number;
  name: string;
}

const STROKE: Record<PlatformId, string> = {
  codeforces: "stroke-platform-codeforces",
  atcoder: "stroke-platform-atcoder",
  leetcode: "stroke-platform-leetcode",
};
const FILL: Record<PlatformId, string> = {
  codeforces: "fill-platform-codeforces",
  atcoder: "fill-platform-atcoder",
  leetcode: "fill-platform-leetcode",
};

const W = 560;
const H = 210;
const PAD = { l: 42, r: 12, t: 12, b: 24 };

const dateFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const monthFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

/** A rating-over-time line (Coach's ratingSVG). Points are oldest first. Scales to its container. */
export function RatingLine({
  platform,
  points,
  label,
}: {
  platform: PlatformId;
  points: RatingPoint[];
  label: string;
}) {
  if (points.length === 0) return null;
  const times = points.map((p) => Date.parse(p.at));
  const ratings = points.map((p) => p.rating);
  const lo = Math.floor((Math.min(...ratings) - 50) / 100) * 100;
  const hi = Math.ceil((Math.max(...ratings) + 50) / 100) * 100;
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (t: number) =>
    t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const grid = Array.from({ length: 5 }, (_, i) => Math.round(lo + (i * (hi - lo)) / 4));
  const xs = times.map((t) => x(t).toFixed(1));
  const coords = points.map((p, i) => `${xs[i]},${y(p.rating).toFixed(1)}`);
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((idx, i, a) => ({
      idx,
      anchor: a.length === 1 ? "middle" : i === 0 ? "start" : i === a.length - 1 ? "end" : "middle",
    }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
      {grid.map((v) => (
        <g key={v}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(v)}
            y2={y(v)}
            strokeWidth={1}
            className="stroke-border"
          />
          <text
            x={PAD.l - 6}
            y={y(v) + 3}
            fontSize={10}
            textAnchor="end"
            className="fill-muted-foreground"
          >
            {v}
          </text>
        </g>
      ))}
      {ticks.map(({ idx, anchor }) => (
        <text
          key={idx}
          x={xs[idx]}
          y={H - 6}
          fontSize={10}
          textAnchor={anchor as "start" | "middle" | "end"}
          className="fill-muted-foreground"
        >
          {monthFmt(times[idx] ?? t0)}
        </text>
      ))}
      {points.length > 1 && (
        <polyline
          points={coords.join(" ")}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={STROKE[platform]}
        />
      )}
      {points.map((p, i) => {
        const last = i === points.length - 1;
        return (
          <circle
            key={`${p.at}-${i}`}
            cx={xs[i]}
            cy={y(p.rating)}
            r={last ? 4 : 2.5}
            strokeWidth={1.5}
            className={
              last ? `${FILL[platform]} ${STROKE[platform]}` : `fill-card ${STROKE[platform]}`
            }
          >
            <title>{`${p.name} · ${dateFmt(times[i] ?? t0)} · ${p.rating}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
