// DB writes for syncs. Every write is idempotent, so an Inngest step can be retried safely:
// problems and solves use ON CONFLICT DO NOTHING (user syncs) or a change-only upsert
// (catalog syncs); stats and activity only rewrite rows whose value changed.

import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { activityDays, platformStats, problems, solves } from "@/lib/db/schema";
import type { CatalogProblem, PlatformId, PlatformSnapshot } from "@/lib/adapters/types";
import { catalogRows, chunk, dedupeSolves, stubRows } from "./rows";

export interface SyncTarget {
  accountId: string;
  userId: string;
  platform: PlatformId;
}

export interface ApplyResult {
  /** New solves rows (≈0 on a repeat sync). */
  solvesInserted: number;
  /** Stub problems rows for problems the catalog doesn't have yet. */
  stubsInserted: number;
  /** Solves dropped because their problem has no catalog row and no fallback metadata. */
  solvesSkipped: number;
}

/** Writes one adapter page: stub problems, solves, platform stats and activity days. */
export async function applySnapshot(
  target: SyncTarget,
  snapshot: PlatformSnapshot,
): Promise<ApplyResult> {
  const { accountId, userId, platform } = target;
  const pageSolves = dedupeSolves(platform, snapshot.solves);
  let stubsInserted = 0;
  let solvesInserted = 0;
  let solvesSkipped = 0;

  for (const batch of chunk(pageSolves)) {
    const stubs = stubRows(platform, batch);
    if (stubs.length > 0) {
      const inserted = await db
        .insert(problems)
        .values(stubs)
        .onConflictDoNothing({ target: [problems.platform, problems.externalId] })
        .returning({ id: problems.id });
      stubsInserted += inserted.length;
    }

    const found = await db
      .select({ id: problems.id, externalId: problems.externalId })
      .from(problems)
      .where(
        and(
          eq(problems.platform, platform),
          inArray(
            problems.externalId,
            batch.map((s) => s.externalProblemId),
          ),
        ),
      );
    const idByExternal = new Map(found.map((p) => [p.externalId, p.id]));

    const rows = batch.flatMap((s) => {
      const problemId = idByExternal.get(s.externalProblemId);
      if (problemId === undefined) return [];
      return [{ userId, accountId, problemId, firstSolvedAt: s.firstSolvedAt ?? null }];
    });
    solvesSkipped += batch.length - rows.length;
    if (rows.length > 0) {
      const inserted = await db
        .insert(solves)
        .values(rows)
        .onConflictDoNothing({ target: [solves.userId, solves.problemId] })
        .returning({ id: solves.id });
      solvesInserted += inserted.length;
    }
  }

  if (snapshot.extras.length > 0) {
    // Last value wins if a page reports the same kind twice.
    const byKind = new Map(snapshot.extras.map((e) => [e.kind, e.payload]));
    await db
      .insert(platformStats)
      .values([...byKind].map(([kind, payload]) => ({ accountId, kind, payload })))
      .onConflictDoUpdate({
        target: [platformStats.accountId, platformStats.kind],
        set: { payload: sql`excluded.payload`, fetchedAt: sql`now()` },
        setWhere: sql`${platformStats.payload} IS DISTINCT FROM excluded.payload`,
      });
  }

  const activity = snapshot.activity ?? [];
  if (activity.length > 0) {
    const byDay = new Map(activity.map((a) => [a.day, a.count]));
    for (const days of chunk([...byDay])) {
      await db
        .insert(activityDays)
        .values(days.map(([day, count]) => ({ accountId, day, count })))
        .onConflictDoUpdate({
          target: [activityDays.accountId, activityDays.day],
          set: { count: sql`excluded.count` },
          setWhere: sql`${activityDays.count} IS DISTINCT FROM excluded.count`,
        });
    }
  }

  return { solvesInserted, stubsInserted, solvesSkipped };
}

/**
 * Upserts a platform's catalog. Only rows that are new, stubs, or changed are written, so a
 * daily refresh of ~11k CF problems costs a handful of row writes. Returns rows written.
 */
export async function upsertCatalog(
  platform: PlatformId,
  catalog: readonly CatalogProblem[],
): Promise<number> {
  const rows = catalogRows(catalog.filter((p) => p.platform === platform));
  let written = 0;
  for (const batch of chunk(rows)) {
    const result = await db
      .insert(problems)
      .values(batch.map((r) => ({ ...r, catalogUpdatedAt: sql`now()` })))
      .onConflictDoUpdate({
        target: [problems.platform, problems.externalId],
        set: {
          title: sql`excluded.title`,
          url: sql`excluded.url`,
          difficultyRaw: sql`excluded.difficulty_raw`,
          difficultyNorm: sql`excluded.difficulty_norm`,
          rawTags: sql`excluded.raw_tags`,
          paidOnly: sql`excluded.paid_only`,
          catalogUpdatedAt: sql`now()`,
        },
        setWhere: sql`${problems.catalogUpdatedAt} IS NULL
          OR (${problems.title}, ${problems.url}, ${problems.difficultyRaw}, ${problems.difficultyNorm}, ${problems.rawTags}, ${problems.paidOnly})
             IS DISTINCT FROM
             (excluded.title, excluded.url, excluded.difficulty_raw, excluded.difficulty_norm, excluded.raw_tags, excluded.paid_only)`,
      })
      .returning({ id: problems.id });
    written += result.length;
  }
  return written;
}
