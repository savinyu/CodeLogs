"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { PLATFORM_META } from "@/lib/platforms";
import {
  PLATFORM_COLOR,
  type ContestEntry,
  type ContestPlatform,
  type PlatformContests,
} from "@/lib/dashboard/types";

type Point = { t: number; entry: ContestEntry } & Partial<Record<ContestPlatform, number>>;

const num = (n: number) => n.toLocaleString("en-US");
const monthYear = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const fullDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function PlatformBlock({ p }: { p: PlatformContests }) {
  const empty = p.contests.length === 0;
  const recent = p.contests.slice(-5).reverse();
  return (
    <div className="min-w-0 rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: PLATFORM_COLOR[p.platform] }}
        />
        {PLATFORM_META[p.platform].name}
        {p.badge && <Badge variant="outline">{p.badge}</Badge>}
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">No rated contests yet</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Stat label="Contests">{num(p.attended)}</Stat>
            <Stat label="Rating">{p.currentRating === null ? "–" : num(p.currentRating)}</Stat>
            <Stat label="Max rating">{p.maxRating === null ? "–" : num(p.maxRating)}</Stat>
            <Stat label="Best rank">{p.bestRank === null ? "–" : `#${num(p.bestRank)}`}</Stat>
            {p.globalRanking != null && <Stat label="Global ranking">#{num(p.globalRanking)}</Stat>}
            {p.topPercentage != null && <Stat label="Top">{p.topPercentage}%</Stat>}
          </dl>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Recent contests</summary>
            <ul className="mt-2 space-y-1">
              {recent.map((c) => (
                <li key={c.contestKey} className="flex items-baseline justify-between gap-2">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </a>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {fullDate(Date.parse(c.heldAt))}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

function ContestTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: Point; dataKey?: unknown }[];
}) {
  if (!active || !payload?.length) return null;
  const seen = new Set<string>();
  const rows = payload.flatMap((item) => {
    const entry = item.payload?.entry;
    if (!entry || item.dataKey !== entry.platform || seen.has(entry.contestKey)) return [];
    seen.add(entry.contestKey);
    return [entry];
  });
  if (rows.length === 0) return null;
  return (
    <div className="grid max-w-64 gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {rows.map((c) => {
        const delta =
          c.oldRating !== null && c.newRating !== null ? c.newRating - c.oldRating : null;
        return (
          <div key={c.contestKey} className="grid gap-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: PLATFORM_COLOR[c.platform] }}
              />
              {c.name}
            </span>
            <span className="text-muted-foreground">{fullDate(Date.parse(c.heldAt))}</span>
            {c.rank !== null && <span>Rank #{num(c.rank)}</span>}
            <span className="tabular-nums">
              {c.oldRating !== null && `${num(c.oldRating)} → `}
              {c.newRating !== null && num(c.newRating)}
              {delta !== null && (
                <span className="text-muted-foreground">
                  {" "}
                  ({delta >= 0 ? "+" : "−"}
                  {num(Math.abs(delta))})
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Contests({
  contests,
  atcoderVisible,
}: {
  contests: PlatformContests[];
  atcoderVisible: boolean;
}) {
  const charted = contests.filter((p) => p.contests.some((c) => c.newRating !== null));

  const config: ChartConfig = {};
  const data: Point[] = [];
  for (const p of charted) {
    config[p.platform] = {
      label: PLATFORM_META[p.platform].name,
      color: PLATFORM_COLOR[p.platform],
    };
    for (const c of p.contests) {
      if (c.newRating === null) continue;
      data.push({ t: Date.parse(c.heldAt), entry: c, [p.platform]: c.newRating });
    }
  }
  data.sort((a, b) => a.t - b.t);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {charted.length > 0 && (
        <ChartContainer config={config} className="aspect-auto h-60 w-full min-w-0 justify-start">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={monthYear}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              minTickGap={32}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              domain={["auto", "auto"]}
              tickFormatter={num}
            />
            <ChartTooltip content={<ContestTooltip />} />
            <ChartLegend content={<ChartLegendContent />} />
            {charted.map((p) => (
              <Line
                key={p.platform}
                dataKey={p.platform}
                type="monotone"
                stroke={`var(--color-${p.platform})`}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
      {contests.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {contests.map((p) => (
            <PlatformBlock key={p.platform} p={p} />
          ))}
        </div>
      )}
      {atcoderVisible && (
        <p className="text-xs text-muted-foreground">
          AtCoder contest history isn&apos;t available: AtCoder&apos;s robots.txt disallows it.
        </p>
      )}
    </div>
  );
}
