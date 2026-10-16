// DB writes for syncs. Every write is idempotent, so an Inngest step can be retried safely:
// problems use ON CONFLICT DO NOTHING (user syncs) or a change-only upsert (catalog syncs);
// solves are insert-only except that an undated solve takes the first date seen; stats,
// activity and contests only rewrite rows whose value changed.

import "server-only";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { activityDays, contestResults, platformStats, problems, solves } from "@/lib/db/schema";
import type {
  CatalogProblem,
  NormalizedContest,
  PlatformId,
  PlatformSnapshot,
} from "@/lib/adapters/types";
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
  /** Existing undated solves (from an import) that got a date from this page. */
  datesFilled: number;
}

/** Writes one adapter page: stub problems, solves, platform stats, activity days and contests. */
export async function applySnapshot(
  target: SyncTarget,
  snapshot: PlatformSnapshot,
  opts: { source?: "api" | "import" | "extension" } = {},
): Promise<ApplyResult> {
  const { accountId, userId, platform } = target;
  const source = opts.source ?? "api";
  const pageSolves = dedupeSolves(platform, snapshot.solves);
  let stubsInserted = 0;
  let solvesInserted = 0;
  let solvesSkipped = 0;
  let datesFilled = 0;

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
      return [{ userId, accountId, problemId, firstSolvedAt: s.firstSolvedAt ?? null, source }];
    });
    solvesSkipped += batch.length - rows.length;
    if (rows.length > 0) {
      // Existing rows keep their date; an undated one (from an import) takes the first date seen.
      const written = await db
        .insert(solves)
        .values(rows)
        .onConflictDoUpdate({
          target: [solves.userId, solves.problemId],
          set: { firstSolvedAt: sql`excluded.first_solved_at` },
          setWhere: sql`${solves.firstSolvedAt} IS NULL AND excluded.first_solved_at IS NOT NULL`,
        })
        .returning({ inserted: sql<boolean>`xmax = 0` });
      const inserted = written.filter((w) => w.inserted).length;
      solvesInserted += inserted;
      datesFilled += written.length - inserted;
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

  if (snapshot.contests !== undefined) await replaceContests(accountId, snapshot.contests);

  return { solvesInserted, stubsInserted, solvesSkipped, datesFilled };
}

/**
 * Makes the account's stored contests match `contests` in one atomic batch: rows no longer
 * listed are deleted, changed rows are updated, unchanged rows aren't written.
 */
async function replaceContests(accountId: string, contests: readonly NormalizedContest[]) {
  const byKey = new Map(contests.map((c) => [c.contestKey, c]));
  const rows = [...byKey.values()].map((c) => ({
    accountId,
    contestKey: c.contestKey,
    name: c.name,
    heldAt: c.heldAt,
    rank: c.rank,
    oldRating: c.oldRating,
    newRating: c.newRating,
    rated: c.rated,
  }));
  const keys = rows.map((r) => r.contestKey);
  const removeStale = db
    .delete(contestResults)
    .where(
      and(
        eq(contestResults.accountId, accountId),
        keys.length > 0 ? notInArray(contestResults.contestKey, keys) : undefined,
      ),
    );
  const upserts = chunk(rows).map((batch) =>
    db
      .insert(contestResults)
      .values(batch)
      .onConflictDoUpdate({
        target: [contestResults.accountId, contestResults.contestKey],
        set: {
          name: sql`excluded.name`,
          heldAt: sql`excluded.held_at`,
          rank: sql`excluded.rank`,
          oldRating: sql`excluded.old_rating`,
          newRating: sql`excluded.new_rating`,
          rated: sql`excluded.rated`,
        },
        setWhere: sql`(${contestResults.name}, ${contestResults.heldAt}, ${contestResults.rank}, ${contestResults.oldRating}, ${contestResults.newRating}, ${contestResults.rated})
          IS DISTINCT FROM
          (excluded.name, excluded.held_at, excluded.rank, excluded.old_rating, excluded.new_rating, excluded.rated)`,
      }),
  );
  await db.batch([removeStale, ...upserts]);
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
