"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { PlatformId } from "@/lib/adapters/types";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";
import { DIFFICULTY_BANDS, PLATFORM_COLOR, type DifficultyRow } from "@/lib/dashboard/types";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Datum = { band: string; hint: string } & Partial<Record<PlatformId, number>>;

export function DifficultyChart({ rows }: { rows: DifficultyRow[] }) {
  if (rows.every((r) => r.total === 0)) {
    return <p className="text-sm text-muted-foreground">No solves to chart yet.</p>;
  }

  const platforms = PLATFORM_ORDER.filter((p) => rows.some((r) => (r.counts[p] ?? 0) > 0));

  const config: ChartConfig = {};
  for (const p of platforms) {
    config[p] = { label: PLATFORM_META[p].name, color: PLATFORM_COLOR[p] };
  }

  const data: Datum[] = rows
    .filter((r) => r.band !== null || r.total > 0)
    .map((r) => {
      const d: Datum = {
        band: r.band === null ? "Unrated" : DIFFICULTY_BANDS[r.band].label,
        hint: r.band === null ? "No difficulty available" : DIFFICULTY_BANDS[r.band].hint,
      };
      for (const p of platforms) d[p] = r.counts[p] ?? 0;
      return d;
    });

  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full justify-start">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="band" tickLine={false} axisLine={false} interval={0} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload as Datum | undefined;
                return (
                  <div className="grid gap-0.5">
                    <span>{d?.band}</span>
                    <span className="font-normal text-muted-foreground">{d?.hint}</span>
                  </div>
                );
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {platforms.map((p, i) => (
          <Bar
            key={p}
            dataKey={p}
            stackId="solves"
            isAnimationActive={false}
            fill={`var(--color-${p})`}
            radius={i === platforms.length - 1 ? [3, 3, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
