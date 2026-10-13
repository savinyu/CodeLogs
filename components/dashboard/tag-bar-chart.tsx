"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import type { PlatformId } from "@/lib/adapters/types";
import { PLATFORM_META } from "@/lib/platforms";
import { PLATFORM_COLOR, type TagStat } from "@/lib/dashboard/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const MAX_LABEL = 20;
const ROW_HEIGHT = 28;

function truncate(label: string) {
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
}

export function TagBarChart({ platform, tags }: { platform: PlatformId; tags: TagStat[] }) {
  const config: ChartConfig = {
    solved: { label: `${PLATFORM_META[platform].name} solves`, color: PLATFORM_COLOR[platform] },
  };
  const data = tags.map((t) => ({ label: t.label, short: truncate(t.label), solved: t.solved }));

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full justify-start"
      style={{ height: data.length * ROW_HEIGHT + 8 }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
        barCategoryGap={4}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="short"
          width={136}
          tickLine={false}
          axisLine={false}
          interval={0}
          fontSize={12}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent hideIndicator labelFormatter={(_, p) => p?.[0]?.payload?.label} />
          }
        />
        <Bar dataKey="solved" fill="var(--color-solved)" radius={3} isAnimationActive={false}>
          <LabelList dataKey="solved" position="right" className="fill-foreground" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
