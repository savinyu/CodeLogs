"use client";

import { useState } from "react";
import { cn } from "cn";
import type { PlatformId } from "@/lib/adapters/types";
import type { DifficultyTier } from "@/lib/dashboard/types";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";

export type RingTone = DifficultyTier | "unrated";

export interface RingSlice {
  label: string;
  /** Shown under the ring for the active slice: the band's tier and rating ranges. */
  hint: string;
  tone: RingTone;
  counts: Partial<Record<PlatformId, number>>;
}

const FILL: Record<RingTone, string> = {
  easy: "fill-band-easy",
  medium: "fill-band-medium",
  hard: "fill-band-hard",
  unrated: "fill-muted",
};

const SWATCH: Record<RingTone, string> = {
  easy: "bg-band-easy",
  medium: "bg-band-medium",
  hard: "bg-band-hard",
  unrated: "bg-muted",
};

const TIER_NAME: Record<RingTone, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  unrated: "",
};

// v1's tag ring (Recharts Pie): radii as a share of the box, degrees between slices.
const OUTER = 47.5;
const INNER = 31;
const PAD = 1.5;

const f = (n: number) => n.toFixed(3);

function point(r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${f(50 + r * Math.sin(a))} ${f(50 - r * Math.cos(a))}`;
}

/** An annulus sector clockwise from `a0` to `a1` degrees, 0 at the top. */
function sector(a0: number, a1: number): string {
  if (a1 - a0 >= 359.99) {
    // A full ring: two half circles each way, cut out with evenodd.
    return `M50 ${50 - OUTER}A${OUTER} ${OUTER} 0 1 1 50 ${50 + OUTER}A${OUTER} ${OUTER} 0 1 1 50 ${50 - OUTER}ZM50 ${50 - INNER}A${INNER} ${INNER} 0 1 0 50 ${50 + INNER}A${INNER} ${INNER} 0 1 0 50 ${50 - INNER}Z`;
  }
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${point(OUTER, a0)}A${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, a1)}L${point(INNER, a1)}A${INNER} ${INNER} 0 ${large} 0 ${point(INNER, a0)}Z`;
}

/**
 * Solves by difficulty band as a ring (v1's tag ring), one slice per band in its tier color, with
 * the total (or the hovered or tapped band) in the middle. Hovering or tapping a slice or its key
 * row shows it; a tap pins it so it stays shown on touch screens.
 */
export function DifficultyRing({ slices, label }: { slices: RingSlice[]; label: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  // Pinned by label, so it survives only while that band still exists (e.g. after ?platform=).
  const [pinnedLabel, setPinnedLabel] = useState<string | null>(null);
  const totals = slices.map((s) => PLATFORM_ORDER.reduce((n, p) => n + (s.counts[p] ?? 0), 0));
  const total = totals.reduce((a, b) => a + b, 0);
  const pad = slices.length > 1 ? PAD : 0;
  const pinnedIndex = pinnedLabel === null ? -1 : slices.findIndex((s) => s.label === pinnedLabel);
  const pinned = pinnedIndex === -1 ? null : pinnedIndex;
  const activeIndex = (hovered !== null && hovered < slices.length ? hovered : null) ?? pinned;
  const active = activeIndex === null ? undefined : slices[activeIndex];
  const activeTotal = activeIndex === null ? 0 : (totals[activeIndex] ?? 0);
  const pin = (i: number) =>
    setPinnedLabel((p) => (p === slices[i]?.label ? null : (slices[i]?.label ?? null)));

  // Each slice starts where the ones before it end, in degrees from the top.
  const spans = totals.map((n) => (total > 0 ? (n / total) * 360 : 0));
  const starts = spans.map((_, i) => spans.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
      <div className="w-full max-w-60 space-y-2">
        <div className="relative aspect-square w-full">
          <svg viewBox="0 0 100 100" role="img" aria-label={label} className="block size-full">
            {slices.map((s, i) => {
              const span = spans[i] ?? 0;
              if (span <= 0) return null;
              const a0 = (starts[i] ?? 0) + pad / 2;
              const a1 = a0 + Math.max(span - pad, 0.5);
              return (
                <path
                  key={`${s.label}-${i}`}
                  d={sector(a0, a1)}
                  fillRule="evenodd"
                  fillOpacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
                  className={cn(FILL[s.tone], "cursor-pointer")}
                  onPointerEnter={() => setHovered(i)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => pin(i)}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-[24%] flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-semibold tabular-nums">
              {active ? activeTotal : total}
            </span>
            <span className="text-xs text-muted-foreground">
              {active ? active.label : "solves"}
            </span>
          </div>
        </div>
        <div className="min-h-10 text-center text-xs text-muted-foreground">
          {active ? (
            <>
              <p>
                {total > 0 ? `${Math.round((activeTotal / total) * 100)}% of solves` : null}
                {PLATFORM_ORDER.filter((p) => (active.counts[p] ?? 0) > 0).map(
                  (p) => ` · ${PLATFORM_META[p].name} ${active.counts[p]}`,
                )}
              </p>
              <p>{active.hint}</p>
            </>
          ) : (
            <p>Hover or tap a slice</p>
          )}
        </div>
      </div>
      <ul className="m-0 grid list-none gap-0.5 p-0 text-sm">
        {slices.map((s, i) => (
          <li key={`${s.label}-${i}`}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-row px-2 py-1 text-left transition-opacity",
                activeIndex !== null && activeIndex !== i && "opacity-50",
              )}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              onClick={() => pin(i)}
            >
              <span
                className={cn("size-2.5 shrink-0 rounded-[2px]", SWATCH[s.tone])}
                aria-hidden="true"
              />
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">{TIER_NAME[s.tone]}</span>
            </button>
          </li>
        ))}
      </ul>
      <ul className="sr-only">
        {slices.map((s, i) => (
          <li key={`${s.label}-${i}`}>{`${s.label} (${s.hint}): ${totals[i] ?? 0}`}</li>
        ))}
      </ul>
    </div>
  );
}
