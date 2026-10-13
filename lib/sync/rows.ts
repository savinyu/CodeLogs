// Pure row builders for lib/sync/upsert.ts, kept separate so they're testable without a DB.

import type { CatalogProblem, NormalizedSolve, PlatformId } from "@/lib/adapters/types";
import { normalizeDifficulty } from "./difficulty";

/** Insert-shaped problems row (matches the problems table minus id and catalogUpdatedAt). */
export interface ProblemRow {
  platform: PlatformId;
  externalId: string;
  title: string;
  url: string;
  difficultyRaw: string | null;
  difficultyNorm: number | null;
  rawTags: string[];
}

export function toProblemRow(
  platform: PlatformId,
  externalId: string,
  p: { title: string; url: string; difficultyRaw?: string | number; rawTags: string[] },
): ProblemRow {
  const raw = p.difficultyRaw;
  return {
    platform,
    externalId,
    title: p.title,
    url: p.url,
    difficultyRaw: raw === undefined || raw === "" ? null : String(raw),
    difficultyNorm: normalizeDifficulty(platform, raw),
    rawTags: [...new Set(p.rawTags)],
  };
}

export function catalogRows(problems: readonly CatalogProblem[]): ProblemRow[] {
  // Last one wins if a catalog lists the same id twice; Postgres rejects duplicate keys in one upsert.
  const byId = new Map<string, ProblemRow>();
  for (const p of problems) byId.set(p.externalId, toProblemRow(p.platform, p.externalId, p));
  return [...byId.values()];
}

/**
 * One solve per problem for this platform, keeping the earliest known time. Adapters already
 * dedupe within a page; this guards the DB write (one upsert can't touch a row twice).
 */
export function dedupeSolves(
  platform: PlatformId,
  solves: readonly NormalizedSolve[],
): NormalizedSolve[] {
  const byId = new Map<string, NormalizedSolve>();
  for (const s of solves) {
    if (s.platform !== platform) continue;
    const seen = byId.get(s.externalProblemId);
    const keep = !seen || isEarlier(s.firstSolvedAt, seen.firstSolvedAt) ? s : seen;
    const other = keep === s ? seen : s;
    byId.set(s.externalProblemId, {
      ...keep,
      problemFallback: keep.problemFallback ?? other?.problemFallback,
    });
  }
  return [...byId.values()];
}

function isEarlier(a: Date | undefined, b: Date | undefined): boolean {
  if (!a) return false;
  return !b || a.getTime() < b.getTime();
}

/** Stub problem rows for solves that carry inline metadata; the catalog sync overwrites them later. */
export function stubRows(platform: PlatformId, solves: readonly NormalizedSolve[]): ProblemRow[] {
  return solves.flatMap((s) =>
    s.problemFallback ? [toProblemRow(platform, s.externalProblemId, s.problemFallback)] : [],
  );
}

/** Splits rows so one statement stays well under Postgres' 65,535 bind-parameter limit. */
export function chunk<T>(items: readonly T[], size = 1000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
