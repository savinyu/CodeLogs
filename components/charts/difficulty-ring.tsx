"use client";

import { useRef, useState } from "react";
import { cn } from "cn";
import type { PlatformId } from "@/lib/adapters/types";
import type { DifficultyTier } from "@/lib/dashboard/types";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";

export type RingTone = DifficultyTier | "unrated";

export interface RingSlice {
  label: string;
  /** Shown under the label in the hover card: the band's rating ranges. */
  hint: string;
  tone: RingTone;
  counts: Partial<Record<PlatformId, number>>;
}

const STROKE: Record<RingTone, string> = {
  easy: "stroke-band-easy",
  medium: "stroke-band-medium",
  hard: "stroke-band-hard",
  unrated: "stroke-muted-foreground/40",
};

const SWATCH: Record<RingTone, string> = {
  easy: "bg-band-easy",
  medium: "bg-band-medium",
  hard: "bg-band-hard",
  unrated: "bg-muted-foreground/40",
};

const TIER_NAME: Record<RingTone, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  unrated: "",
};

const PLATFORM_SWATCH: Record<PlatformId, string> = {
  codeforces: "bg-platform-codeforces",
  atcoder: "bg-platform-atcoder",
  leetcode: "bg-platform-leetcode",
};

const SIZE = 200;
const STROKE_W = 26;
const R = (SIZE - STROKE_W) / 2;
const C = SIZE / 2;
/** Space between slices, in pathLength units (the ring is 100). */
const GAP = 1.2;

/**
 * Solves by difficulty band as a donut, one slice per band in its tier color. The center shows the
 * total; hovering a slice (or its key row) shows that band's count there, and a card with its
 * rating ranges and per-platform counts follows the pointer.
 */
export function DifficultyRing({ slices, label }: { slices: RingSlice[]; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x?: number; y?: number; flip?: boolean } | null>(
    null,
  );
  const totals = slices.map((s) => PLATFORM_ORDER.reduce((n, p) => n + (s.counts[p] ?? 0), 0));
  const total = totals.reduce((a, b) => a + b, 0);
  const shown = slices.filter((_, i) => (totals[i] ?? 0) > 0).length;
  const gap = shown > 1 ? GAP : 0;

  function track(i: number, e: React.PointerEvent) {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return setHover({ i });
    const x = e.clientX - box.left;
    setHover({ i, x, y: e.clientY - box.top, flip: x > box.width / 2 });
  }

  // Each slice starts where the ones before it end, as a share of the ring's 100 units.
  const lens = totals.map((n) => (total > 0 ? (n / total) * 100 : 0));
  const arcs = lens.map((len, i) => ({
    i,
    len,
    start: lens.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  const active = hover ? slices[hover.i] : undefined;
  const activeTotal = hover ? (totals[hover.i] ?? 0) : total;
  const series = PLATFORM_ORDER.filter((p) => slices.some((s) => (s.counts[p] ?? 0) > 0));

  return (
    <div
      ref={wrap}
      className="relative flex flex-wrap items-center justify-center gap-x-8 gap-y-4 py-2"
    >
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={label}
          onPointerLeave={() => setHover(null)}
        >
          <circle cx={C} cy={C} r={R} fill="none" strokeWidth={STROKE_W} className="stroke-muted" />
          {arcs.map(({ i, start: s, len }) => {
            const slice = slices[i];
            if (!slice || len <= 0) return null;
            const visible = Math.max(len - gap, 0.4);
            return (
              <circle
                key={`${slice.label}-${i}`}
                cx={C}
                cy={C}
                r={R}
                fill="none"
                strokeWidth={STROKE_W}
                pathLength={100}
                strokeDasharray={`${visible} ${100 - visible}`}
                strokeDashoffset={-(s + gap / 2)}
                transform={`rotate(-90 ${C} ${C})`}
                className={cn(
                  STROKE[slice.tone],
                  "cursor-default transition-opacity",
                  hover && hover.i !== i && "opacity-35",
                )}
                onPointerMove={(e) => track(i, e)}
                onPointerDown={(e) => track(i, e)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="font-display text-3xl leading-none font-bold tabular-nums">
            {activeTotal}
          </span>
          <span className="mt-1 text-sm text-muted-foreground">
            {active ? active.label : "solved"}
          </span>
        </div>
      </div>
      <ul className="m-0 grid list-none gap-1 p-0 text-sm" onPointerLeave={() => setHover(null)}>
        {slices.map((s, i) =>
          (totals[i] ?? 0) > 0 ? (
            <li
              key={`${s.label}-${i}`}
              className={cn(
                "flex items-center gap-2 rounded-row px-2 py-1 transition-opacity",
                hover && hover.i !== i && "opacity-50",
              )}
              onPointerEnter={() => setHover({ i })}
            >
              <span
                className={cn("size-2.5 shrink-0 rounded-[2px]", SWATCH[s.tone])}
                aria-hidden="true"
              />
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">{TIER_NAME[s.tone]}</span>
            </li>
          ) : null,
        )}
      </ul>
      {hover && active && hover.x !== undefined && hover.y !== undefined ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 left-0 z-10 grid max-w-64 min-w-36 gap-1.5 rounded-row bg-popover px-3 py-2 text-xs text-popover-foreground shadow-pop",
            hover.flip && "-translate-x-full",
          )}
          style={{ left: hover.x + (hover.flip ? -12 : 12), top: Math.max(0, hover.y - 24) }}
        >
          <div className="grid gap-0.5 font-semibold">
            <span>{active.label}</span>
            <span className="font-normal text-muted-foreground">{active.hint}</span>
          </div>
          {series.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className={cn("size-2.5 shrink-0 rounded-[2px]", PLATFORM_SWATCH[p])} />
              <span className="flex-1 text-muted-foreground">{PLATFORM_META[p].name}</span>
              <span className="font-mono font-medium tabular-nums">{active.counts[p] ?? 0}</span>
            </div>
          ))}
        </div>
      ) : null}
      <ul className="sr-only">
        {slices.map((s, i) => (
          <li key={`${s.label}-${i}`}>
            {`${s.label} (${s.hint}): ${totals[i] ?? 0} total; ${series.map((p) => `${PLATFORM_META[p].name} ${s.counts[p] ?? 0}`).join(", ")}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
