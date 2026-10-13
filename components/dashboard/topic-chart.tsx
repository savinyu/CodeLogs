"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { PlatformId } from "@/lib/adapters/types";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";
import { PLATFORM_COLOR, type MacroTopicStat } from "@/lib/dashboard/types";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";

type Datum = {
  name: string;
  expected: Partial<Record<PlatformId, number>>;
} & Partial<Record<PlatformId, number>>;

const MAX_LABEL = 20;

function shorten(name: string): string {
  return name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1)}…` : name;
}

function TopicTooltip({
  active,
  payload,
  platforms,
  showExpected,
}: {
  active?: boolean;
  payload?: { payload?: Datum }[];
  platforms: PlatformId[];
  showExpected: boolean;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{d.name}</div>
      {platforms.map((p) => (
        <div key={p} className="grid gap-0.5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: PLATFORM_COLOR[p] }}
            />
            <span className="text-muted-foreground">{PLATFORM_META[p].name}</span>
            <span className="ml-auto font-mono font-medium tabular-nums">{d[p] ?? 0}</span>
          </div>
          {showExpected && d.expected[p] !== undefined && (
            <span className="pl-4.5 text-[11px] text-muted-foreground/80">
              ~{Math.round(d.expected[p] ?? 0)} expected at your level
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** `showExpected` adds the scoring expectation to the tooltip: owner only (scores are private). */
export function TopicChart({
  topics,
  showExpected,
}: {
  topics: MacroTopicStat[];
  showExpected: boolean;
}) {
  if (topics.every((t) => t.platforms.length === 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        Topics come from Codeforces and LeetCode tags. AtCoder problems have no tags.
      </p>
    );
  }

  const platforms = PLATFORM_ORDER.filter((p) =>
    topics.some((t) => t.platforms.some((s) => s.platform === p)),
  );

  const config: ChartConfig = {};
  for (const p of platforms) {
    config[p] = { label: PLATFORM_META[p].name, color: PLATFORM_COLOR[p] };
  }

  const data: Datum[] = topics.map((t) => {
    const d: Datum = { name: t.name, expected: {} };
    for (const p of platforms) {
      const s = t.platforms.find((x) => x.platform === p);
      d[p] = s ? Math.round(s.solved) : 0;
      if (s) d.expected[p] = s.expected;
    }
    return d;
  });

  return (
    <div className="space-y-2">
      <ChartContainer
        config={config}
        className="aspect-auto w-full justify-start"
        style={{ height: topics.length * 30 + 48 }}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          barCategoryGap={6}
        >
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={140}
            interval={0}
            fontSize={11}
            tickFormatter={shorten}
          />
          <ChartTooltip
            cursor={false}
            content={<TopicTooltip platforms={platforms} showExpected={showExpected} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {platforms.map((p, i) => (
            <Bar
              key={p}
              dataKey={p}
              stackId="solves"
              isAnimationActive={false}
              fill={`var(--color-${p})`}
              radius={i === platforms.length - 1 ? [0, 3, 3, 0] : 0}
            />
          ))}
        </BarChart>
      </ChartContainer>
      {platforms.includes("leetcode") && (
        <p className="text-xs text-muted-foreground">
          LeetCode counts are estimated from its per-tag totals; a problem can sit in more than one
          topic.
        </p>
      )}
    </div>
  );
}
