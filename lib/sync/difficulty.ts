// Maps each platform's raw difficulty onto problems.difficulty_norm (1 = easiest … 5; null = unrated).
// Bands are our own rough cross-platform equivalents, not official conversions. Each band sits
// inside one Easy / Medium / Hard tier, so the chart and the colored tags agree:
//   1 easy   ≈ CF ≤ 1100      · AtCoder < 400    · LC Easy
//   2 medium ≈ CF 1200–1300   · AtCoder 400–599
//   3 medium ≈ CF 1400–1600   · AtCoder 600–899  · LC Medium
//   4 hard   ≈ CF 1700–2000   · AtCoder 900–1299 · LC Hard
//   5 hard   ≈ CF 2100+       · AtCoder 1300+
// Changing a cut means a data migration for stored rows (see 0003_difficulty_bands.sql).
// Pure, so tests and adapters can use it.

import type { PlatformId } from "@/lib/adapters/types";

function band(value: number, cuts: readonly [number, number, number, number]): number {
  const i = cuts.findIndex((cut) => value < cut);
  return i === -1 ? 5 : i + 1;
}

const LEETCODE: Record<string, number> = { easy: 1, medium: 3, hard: 4 };

export function normalizeDifficulty(
  platform: PlatformId,
  raw: string | number | null | undefined,
): number | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (platform === "leetcode") return LEETCODE[String(raw).toLowerCase()] ?? null;

  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return null;
  // AtCoder models can be negative (very easy problems); they land in band 1.
  return platform === "codeforces"
    ? band(value, [1200, 1400, 1700, 2100])
    : band(value, [400, 600, 900, 1300]);
}

export type DifficultyTier = "easy" | "medium" | "hard";

/** The tier each band (index = band) belongs to. */
export const BAND_TIER: Record<1 | 2 | 3 | 4 | 5, DifficultyTier> = {
  1: "easy",
  2: "medium",
  3: "medium",
  4: "hard",
  5: "hard",
};

/**
 * Easy / Medium / Hard for the colored difficulty tags, read off the band: Codeforces ≤ 1100
 * easy, 1200–1600 medium, ≥ 1700 hard; AtCoder < 400 easy, 400–899 medium, ≥ 900 hard;
 * LeetCode its own labels.
 */
export function difficultyTier(platform: PlatformId, raw: string | null): DifficultyTier | null {
  const band = normalizeDifficulty(platform, raw);
  return band === null ? null : (BAND_TIER[band as keyof typeof BAND_TIER] ?? null);
}

/**
 * The difficulty AtCoder Problems shows: kenkoooo's model values below 400 (often negative) are
 * squashed into (0, 400) so they stay positive. Order is kept, so tiers and bands don't change.
 */
export function displayAtcoderDifficulty(raw: number): number {
  return Math.round(raw >= 400 ? raw : 400 / Math.exp(1 - raw / 400));
}
