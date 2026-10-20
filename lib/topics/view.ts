// View model for the Topics page and the public topic map. Pure.

import type { PlatformId } from "@/lib/adapters/types";
import type { MacroTopicStat, TopicStat } from "@/lib/dashboard/types";
import { scoreTopic, solvesToLeaveWeak, WEAK_BELOW } from "./scoring";
import type { MacroSlug, TopicSlug } from "./taxonomy";

export type TopicState = "weak" | "ontrack" | "strong";

export interface MicroView {
  slug: TopicSlug;
  name: string;
  solved: number;
  expected: number;
  coverage: number;
  state: TopicState;
}

export interface TopicView {
  slug: MacroSlug;
  name: string;
  solved: number;
  expected: number;
  coverage: number;
  state: TopicState;
  /** Coverage step 1-5 (owner map colour). */
  step: 1 | 2 | 3 | 4 | 5;
  platforms: { platform: PlatformId; solved: number; expected: number }[];
  micros: MicroView[];
  /** Problems still to solve to reach WEAK_BELOW; 0 when the topic isn't weak. */
  toLeaveWeak: number;
}

export function topicState(coverage: number): TopicState {
  return coverage < WEAK_BELOW ? "weak" : coverage > 1.1 ? "strong" : "ontrack";
}

/** Owner map colour: under 50%, under WEAK_BELOW, under 100%, up to 120%, over 120%. */
export function coverageStep(coverage: number): 1 | 2 | 3 | 4 | 5 {
  if (coverage < 0.5) return 1;
  if (coverage < WEAK_BELOW) return 2;
  if (coverage < 1) return 3;
  if (coverage <= 1.2) return 4;
  return 5;
}

/** Public map colour by solves: under 25, 25-44, 45-99, 100 or more. */
export function publicStep(solved: number): 1 | 2 | 3 | 4 {
  return solved >= 100 ? 4 : solved >= 45 ? 3 : solved >= 25 ? 2 : 1;
}

function micro(m: TopicStat): MicroView {
  const s = scoreTopic(m);
  return {
    slug: m.slug,
    name: m.name,
    solved: s.solved,
    expected: s.expected,
    coverage: s.coverage,
    state: topicState(s.coverage),
  };
}

/** Every macro topic as a plain view, in the order given. */
export function topicViews(topics: MacroTopicStat[]): TopicView[] {
  return topics.map((t) => {
    const s = scoreTopic(t);
    const state = topicState(s.coverage);
    return {
      slug: t.slug,
      name: t.name,
      solved: s.solved,
      expected: s.expected,
      coverage: s.coverage,
      state,
      step: coverageStep(s.coverage),
      platforms: t.platforms.map((p) => ({
        platform: p.platform,
        solved: p.solved,
        expected: p.expected,
      })),
      micros: t.micros.map(micro),
      toLeaveWeak: state === "weak" ? Math.max(1, solvesToLeaveWeak(s)) : 0,
    };
  });
}

/** 0.834 -> "83%". */
export function formatPct(coverage: number): string {
  return `${Math.round(coverage * 100)}%`;
}
