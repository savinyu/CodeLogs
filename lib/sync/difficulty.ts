// Maps each platform's raw difficulty onto problems.difficulty_norm (1 = easiest … 5; null = unrated).
// Bands are rough cross-platform equivalents, not official conversions:
//   1 ≈ CF < 1200 · AtCoder < 400  · LC Easy
//   2 ≈ CF < 1600 · AtCoder < 800
//   3 ≈ CF < 2000 · AtCoder < 1200 · LC Medium
//   4 ≈ CF < 2400 · AtCoder < 1600 · LC Hard
//   5 ≈ above that
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
    ? band(value, [1200, 1600, 2000, 2400])
    : band(value, [400, 800, 1200, 1600]);
}

export type DifficultyTier = "easy" | "medium" | "hard";

/**
 * Easy / Medium / Hard for the colored difficulty tags. LeetCode uses its own labels; Codeforces
 * ratings split at ≤ 1100 easy, 1200–1600 medium, ≥ 1700 hard. AtCoder has no tier yet (null).
 */
export function difficultyTier(platform: PlatformId, raw: string | null): DifficultyTier | null {
  if (raw === null || raw === "") return null;
  if (platform === "leetcode") {
    const label = raw.toLowerCase();
    return label === "easy" || label === "medium" || label === "hard" ? label : null;
  }
  if (platform !== "codeforces") return null;
  const rating = Number(raw);
  if (!Number.isFinite(rating)) return null;
  return rating < 1200 ? "easy" : rating < 1700 ? "medium" : "hard";
}
