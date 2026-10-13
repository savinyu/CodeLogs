// The dashboard's view model. Pure types and constants: server queries build it, and client
// chart components receive it as props, so nothing here may import the DB.

import type { PlatformId } from "@/lib/adapters/types";
import type { MacroSlug, TopicSlug } from "@/lib/topics/taxonomy";

export type PlatformFilter = PlatformId | "all";

export type AccountStatus = "pending" | "syncing" | "ok" | "partial" | "error";

export interface AccountSummary {
  platform: PlatformId;
  handle: string;
  status: AccountStatus;
  verified: boolean;
  historyComplete: boolean;
  /** ISO timestamp. */
  lastSyncedAt: string | null;
}

/**
 * Where a number comes from. "tracked" = counted from the solve rows we hold (CF, AtCoder).
 * "reported" = the platform's own lifetime figure (LeetCode), wider than our rows, so the UI
 * labels it as a count rather than a list.
 */
export type CountSource = "tracked" | "reported";

export interface PlatformTotal {
  platform: PlatformId;
  solved: number;
  source: CountSource;
  /** Codeforces only, for now. */
  rating?: { current: number; max: number; rank?: string };
}

/**
 * One UTC day with any activity. Codeforces and AtCoder count problems first solved that day;
 * LeetCode counts accepted submissions from its public calendar.
 */
export interface ActivityDay {
  /** YYYY-MM-DD (UTC). */
  day: string;
  counts: Partial<Record<PlatformId, number>>;
  total: number;
}

export type DifficultyBand = 1 | 2 | 3 | 4 | 5;

/** One row per band, always in order 1–5 then unrated (band null), even when empty. */
export interface DifficultyRow {
  band: DifficultyBand | null;
  counts: Partial<Record<PlatformId, number>>;
  total: number;
}

export interface TagStat {
  /** Raw platform tag: CF "dp", LC slug "hash-table". */
  tag: string;
  /** Display name: "dp", "Hash Table". */
  label: string;
  solved: number;
  /** How many catalog problems carry the tag; used to surface popular tags you haven't solved. */
  catalogCount: number;
}

/** Raw tags per platform (M4 maps them onto one shared topic list). AtCoder has no tags. */
export interface PlatformTags {
  platform: PlatformId;
  source: CountSource;
  /** Sorted by solved desc, then catalogCount desc. Includes popular tags with solved = 0 (gaps). */
  tags: TagStat[];
}

/** One platform's part of a topic. See lib/topics/scoring.ts for the formula. */
export interface TopicPlatformStat {
  platform: PlatformId;
  /** Problems solved in the topic. LeetCode's is estimated from its lifetime tag counts. */
  solved: number;
  /** Solves weighted by difficulty against your level (CF); the estimate itself on LeetCode. */
  weighted: number;
  /** What you'd have solved in the topic if your solves mirrored the platform's catalog. */
  expected: number;
}

export interface TopicStat {
  slug: TopicSlug;
  name: string;
  /** Platforms with topic data (CF, LC); empty when none is connected. */
  platforms: TopicPlatformStat[];
}

export interface MacroTopicStat extends TopicStat {
  slug: MacroSlug;
  micros: TopicStat[];
}

export interface RecentSolve {
  platform: PlatformId;
  externalId: string;
  title: string;
  url: string;
  /** ISO timestamp. */
  solvedAt: string | null;
  difficultyRaw: string | null;
  difficultyNorm: DifficultyBand | null;
  tags: string[];
}

export interface DashboardData {
  /** YYYY-MM-DD (UTC): the last day the heatmap covers. */
  asOf: string;
  accounts: AccountSummary[];
  /** One per connected account, in PLATFORM_ORDER. */
  totals: PlatformTotal[];
  /** Every day with activity up to asOf (all years), ascending. The heatmap picks its period. */
  activity: ActivityDay[];
  difficulty: DifficultyRow[];
  /** Only platforms that have tags and are connected. */
  tags: PlatformTags[];
  /** Every macro topic, in taxonomy order (lib/topics). */
  topics: MacroTopicStat[];
  /** The CF rating that weights and recommendations use (lib/topics/scoring.ts cfLevel). */
  cfLevel: number | null;
  /** Newest first: up to RECENT_LIMIT per platform until filterDashboard trims it. */
  recent: RecentSolve[];
}

/** Neutral names: the hint says which tier and ranges each band covers (lib/sync/difficulty.ts). */
export const DIFFICULTY_BANDS: Record<DifficultyBand, { label: string; hint: string }> = {
  1: { label: "Band 1", hint: "Easy · CF ≤ 1100 · AtCoder < 400 · LC Easy" },
  2: { label: "Band 2", hint: "Medium · CF 1200–1300 · AtCoder 400–599" },
  3: { label: "Band 3", hint: "Medium · CF 1400–1600 · AtCoder 600–899 · LC Medium" },
  4: { label: "Band 4", hint: "Hard · CF 1700–2000 · AtCoder 900–1299 · LC Hard" },
  5: { label: "Band 5", hint: "Hard · CF 2100+ · AtCoder 1300+" },
};

/** Chart color per platform, as CSS variables from app/globals.css (they switch with the theme). */
export const PLATFORM_COLOR: Record<PlatformId, string> = {
  codeforces: "var(--platform-codeforces)",
  atcoder: "var(--platform-atcoder)",
  leetcode: "var(--platform-leetcode)",
};
