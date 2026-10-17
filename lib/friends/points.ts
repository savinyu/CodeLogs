import type { PlatformId } from "@/lib/adapters/types";
import type { DifficultyBand } from "@/lib/dashboard/types";

/** One person's week on a board. */
export type BoardEntry = {
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  points: number;
  solves: number;
  activeDays: number;
  /** Solves per platform. */
  platforms: Partial<Record<PlatformId, number>>;
};

export type RankedEntry = BoardEntry & { rank: number };

/** A solve earns its difficulty band (1 to 5); an unrated one earns 1. */
export function solvePoints(band: DifficultyBand | null): number {
  return band ?? 1;
}

/** Orders by points, then solves, then active days, then name. Ranks are 1-based and unique. */
export function rankBoard<T extends BoardEntry>(entries: T[]): (T & { rank: number })[] {
  return [...entries]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.solves - a.solves ||
        b.activeDays - a.activeDays ||
        a.name.localeCompare(b.name) ||
        a.userId.localeCompare(b.userId),
    )
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}
