// Sync bookkeeping: claiming accounts for a sync, sync_runs / catalog_syncs rows, and the
// account status the UI shows. The Inngest functions call these; they hold no fetch logic.

import "server-only";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { catalogSyncs, platformAccounts, platformStats, solves, syncRuns } from "@/lib/db/schema";
import type { HistoryCompleteness, PlatformId, SyncCursor } from "@/lib/adapters/types";
import { parseCursor } from "./cursor";

/** A user can't queue the same account again within this window. */
export const SYNC_COOLDOWN_MS = 5 * 60_000;
/** A "syncing" account whose request is older than this is assumed stuck and may be re-queued. */
export const SYNC_STALE_MS = 30 * 60_000;

export interface ClaimedAccount {
  accountId: string;
  platform: PlatformId;
}

/**
 * Atomically marks the user's accounts as syncing and returns the ones claimed. Skips accounts
 * inside the cooldown or already syncing (unless stuck). Pass `platforms` to limit the claim,
 * and `ignoreCooldown` for the automatic first sync after connecting a handle.
 */
export async function claimAccountsForSync(
  userId: string,
  opts: { platforms?: PlatformId[]; ignoreCooldown?: boolean } = {},
): Promise<ClaimedAccount[]> {
  const cooldownCutoff = sql`now() - make_interval(secs => ${SYNC_COOLDOWN_MS / 1000})`;
  const staleCutoff = sql`now() - make_interval(secs => ${SYNC_STALE_MS / 1000})`;
  const requestedBefore = (cutoff: typeof cooldownCutoff) =>
    or(isNull(platformAccounts.syncRequestedAt), lt(platformAccounts.syncRequestedAt, cutoff));

  return db
    .update(platformAccounts)
    .set({ status: "syncing", syncRequestedAt: sql`now()`, lastError: null })
    .where(
      and(
        eq(platformAccounts.userId, userId),
        opts.platforms ? inArray(platformAccounts.platform, opts.platforms) : undefined,
        opts.ignoreCooldown ? undefined : requestedBefore(cooldownCutoff),
        or(sql`${platformAccounts.status} <> 'syncing'`, requestedBefore(staleCutoff)),
      ),
    )
    .returning({ accountId: platformAccounts.id, platform: platformAccounts.platform });
}

/** Undo a claim when the sync event couldn't be sent. */
export async function releaseClaim(accountIds: string[], error: string): Promise<void> {
  if (accountIds.length === 0) return;
  await db
    .update(platformAccounts)
    .set({ status: "error", lastError: error, syncRequestedAt: null })
    .where(inArray(platformAccounts.id, accountIds));
}

export interface SyncAccount {
  accountId: string;
  userId: string;
  platform: PlatformId;
  handle: string;
  cursor: SyncCursor | null;
  historyComplete: boolean;
}

/** Loads an account and opens a sync_runs row. Returns null if the account was removed. */
export async function startAccountSync(
  accountId: string,
): Promise<(SyncAccount & { runId: number }) | null> {
  const [account] = await db
    .select()
    .from(platformAccounts)
    .where(eq(platformAccounts.id, accountId))
    .limit(1);
  if (!account) return null;

  const [, [run]] = await db.batch([
    db
      .update(platformAccounts)
      .set({ status: "syncing" })
      .where(eq(platformAccounts.id, accountId)),
    db.insert(syncRuns).values({ accountId }).returning({ id: syncRuns.id }),
  ]);
  if (!run) throw new Error("Could not create a sync_runs row");

  return {
    runId: run.id,
    accountId,
    userId: account.userId,
    platform: account.platform,
    handle: account.handle,
    cursor: parseCursor(account.platform, account.syncCursor),
    historyComplete: account.historyComplete,
  };
}

/** Closes a successful run and saves the cursor. Status is "partial" when the platform only exposes part of the history. */
export async function finishAccountSync(args: {
  accountId: string;
  runId: number;
  cursor: SyncCursor | null;
  items: number;
  history: HistoryCompleteness;
  historyComplete: boolean;
}): Promise<void> {
  const status = args.history === "full" || args.historyComplete ? "ok" : "partial";
  await db.batch([
    db
      .update(platformAccounts)
      .set({
        status,
        syncCursor: args.cursor,
        lastSyncedAt: sql`now()`,
        lastError: null,
      })
      .where(eq(platformAccounts.id, args.accountId)),
    db
      .update(syncRuns)
      .set({ status: "ok", finishedAt: sql`now()`, items: args.items })
      .where(eq(syncRuns.id, args.runId)),
  ]);
  // LeetCode only shows the latest 20 solves: a gap since the import flips the account back to partial.
  if (args.history === "recent_only") await refreshHistoryComplete(args.accountId);
}

/**
 * Recomputes `history_complete` for a recent-only account (LeetCode): complete when at least one
 * solve came from an import and the known solve count reaches LeetCode's lifetime total
 * (platform_stats `lc_difficulty_counts`; a missing stat counts as complete). Also sets status to
 * ok/partial, never overwriting "syncing". One UPDATE. Returns the new value.
 */
export async function refreshHistoryComplete(accountId: string): Promise<boolean> {
  const complete = sql<boolean>`(
    EXISTS (SELECT 1 FROM ${solves} WHERE ${solves.accountId} = ${platformAccounts.id} AND ${solves.source} = 'import')
    AND COALESCE(
      (SELECT count(*) FROM ${solves} WHERE ${solves.accountId} = ${platformAccounts.id})
        >= (SELECT (${platformStats.payload}->'solved'->>'all')::int FROM ${platformStats}
            WHERE ${platformStats.accountId} = ${platformAccounts.id} AND ${platformStats.kind} = 'lc_difficulty_counts'),
      true)
  )`;
  const [row] = await db
    .update(platformAccounts)
    .set({
      historyComplete: complete,
      status: sql`CASE WHEN ${platformAccounts.status} = 'syncing' THEN ${platformAccounts.status}
        WHEN ${complete} THEN 'ok'::account_status ELSE 'partial'::account_status END`,
    })
    .where(eq(platformAccounts.id, accountId))
    .returning({ historyComplete: platformAccounts.historyComplete });
  return row?.historyComplete ?? false;
}

/**
 * Marks the account as errored and closes its run. Without a runId, it closes the account's
 * latest open run (used by Inngest's onFailure, which doesn't see step outputs).
 */
export async function failAccountSync(args: {
  accountId: string;
  runId?: number;
  error: string;
}): Promise<void> {
  const error = args.error.slice(0, 1000);
  const runFilter =
    args.runId !== undefined
      ? eq(syncRuns.id, args.runId)
      : inArray(
          syncRuns.id,
          db
            .select({ id: syncRuns.id })
            .from(syncRuns)
            .where(and(eq(syncRuns.accountId, args.accountId), eq(syncRuns.status, "running")))
            .orderBy(desc(syncRuns.startedAt))
            .limit(1),
        );
  await db.batch([
    db
      .update(platformAccounts)
      .set({ status: "error", lastError: error })
      .where(eq(platformAccounts.id, args.accountId)),
    db
      .update(syncRuns)
      .set({ status: "error", finishedAt: sql`now()`, error })
      .where(runFilter),
  ]);
}

export async function startCatalogSync(platform: PlatformId): Promise<number> {
  const [row] = await db
    .insert(catalogSyncs)
    .values({ platform })
    .returning({ id: catalogSyncs.id });
  if (!row) throw new Error("Could not create a catalog_syncs row");
  return row.id;
}

export async function finishCatalogSync(id: number, rows: number): Promise<void> {
  await db
    .update(catalogSyncs)
    .set({ status: "ok", finishedAt: sql`now()`, rows })
    .where(eq(catalogSyncs.id, id));
}

/** Closes a catalog run as failed. Without an id, closes the platform's latest open run (for onFailure). */
export async function failCatalogSync(args: {
  platform: PlatformId;
  id?: number;
  error: string;
}): Promise<void> {
  const target =
    args.id !== undefined
      ? eq(catalogSyncs.id, args.id)
      : inArray(
          catalogSyncs.id,
          db
            .select({ id: catalogSyncs.id })
            .from(catalogSyncs)
            .where(
              and(eq(catalogSyncs.platform, args.platform), eq(catalogSyncs.status, "running")),
            )
            .orderBy(desc(catalogSyncs.startedAt))
            .limit(1),
        );
  await db
    .update(catalogSyncs)
    .set({ status: "error", finishedAt: sql`now()`, error: args.error.slice(0, 1000) })
    .where(target);
}
