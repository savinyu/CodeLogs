"use client";

import { useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import type { PlatformId } from "@/lib/adapters/types";
import { PLATFORM_COLOR, type TagStat } from "@/lib/dashboard/types";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

const TOP = 10;

interface Slice {
  key: string;
  label: string;
  solved: number;
  fill: string;
}

/** Top tags as shades of the platform color, plus one muted slice for the rest. */
function slices(platform: PlatformId, tags: TagStat[]): Slice[] {
  const top = tags.slice(0, TOP);
  const rest = tags.slice(TOP).reduce((sum, t) => sum + t.solved, 0);
  const out: Slice[] = top.map((t, i) => ({
    key: t.tag,
    label: t.label,
    solved: t.solved,
    // 100% → 30%: the biggest tags get the strongest shade.
    fill: `color-mix(in oklch, ${PLATFORM_COLOR[platform]} ${100 - Math.round((i * 70) / Math.max(top.length - 1, 1))}%, var(--background))`,
  }));
  if (rest > 0) {
    out.push({ key: "__other", label: "Other tags", solved: rest, fill: "var(--muted)" });
  }
  return out;
}

/**
 * Tag share as a pie or a ring. Labels stay hidden until a slice is hovered or tapped; a tap pins
 * the slice so it stays shown on touch screens.
 */
export function TagPieChart({
  platform,
  tags,
  variant,
}: {
  platform: PlatformId;
  tags: TagStat[];
  variant: "pie" | "ring";
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const data = slices(platform, tags);
  const total = data.reduce((sum, s) => sum + s.solved, 0);
  const activeIndex = hovered ?? pinned;
  const active = activeIndex === null ? undefined : data[activeIndex];
  const config: ChartConfig = { solved: { label: "Solves" } };
  const ring = variant === "ring";

  return (
    <div className="space-y-2">
      <div className="relative mx-auto aspect-square w-full max-w-60">
        <ChartContainer config={config} className="aspect-square h-full w-full">
          <PieChart>
            <Pie
              data={data}
              dataKey="solved"
              nameKey="label"
              innerRadius={ring ? "62%" : 0}
              outerRadius="95%"
              paddingAngle={ring ? 1.5 : 0}
              stroke="var(--background)"
              strokeWidth={ring ? 0 : 1.5}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              className="cursor-pointer"
              onMouseEnter={(_, i) => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={(_, i) => setPinned((p) => (p === i ? null : i))}
            >
              {data.map((s, i) => (
                <Cell
                  key={s.key}
                  fill={s.fill}
                  fillOpacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {ring ? (
          <div className="pointer-events-none absolute inset-[24%] flex flex-col items-center justify-center text-center">
            {active ? (
              <>
                <span className="text-2xl font-semibold tabular-nums">{active.solved}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{active.label}</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-semibold tabular-nums">{total}</span>
                <span className="text-xs text-muted-foreground">tagged solves</span>
              </>
            )}
          </div>
        ) : null}
      </div>
      {!ring ? (
        <p className="h-5 truncate text-center text-sm" aria-live="polite">
          {active ? (
            <>
              <span className="font-medium">{active.label}</span>
              <span className="text-muted-foreground">
                {" "}
                · {active.solved} ({Math.round((active.solved / total) * 100)}%)
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Hover or tap a slice</span>
          )}
        </p>
      ) : (
        <p className="h-5 text-center text-xs text-muted-foreground">
          {active
            ? `${Math.round((active.solved / total) * 100)}% of tagged solves`
            : "Hover or tap a segment"}
        </p>
      )}
      <ul className="sr-only">
        {data.map((s) => (
          <li key={s.key}>
            {s.label}: {s.solved}
          </li>
        ))}
      </ul>
    </div>
  );
}
