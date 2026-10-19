// Picks the accounts the daily cron should re-sync. One atomic UPDATE ... RETURNING claims them,
// so overlapping runs (or a user pressing "Sync now") can't queue the same account twice.

import "server-only";
import { and, eq, exists, inArray, or, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { platformAccounts, sessions, SYNCED_PLATFORMS, users } from "@/lib/db/schema";
import { SYNC_STALE_MS, type ClaimedAccount } from "./runs";

/** 20 h, not 24, so a daily cron doesn't drift past a day. Also the retry spacing after a failure. */
export const STALE_AFTER_MS = 20 * 60 * 60_000;
/** Users with a session touched within this window (or a public profile) get background syncs. */
export const ACTIVE_WITHIN_MS = 30 * 24 * 60 * 60_000;

/** The WHERE clause shared by the claim and by read-only checks. `now` defaults to the DB clock. */
export function staleAccountsWhere(now?: Date): SQL {
  const nowExpr = now ? sql`${now.toISOString()}::timestamptz` : sql`now()`;
  const ago = (ms: number) => sql`${nowExpr} - make_interval(secs => ${ms / 1000})`;
  const olderThan = (col: AnyPgColumn, ms: number) => or(isNull(col), lt(col, ago(ms)));

  const activeUser = or(
    exists(
      db
        .select({ one: sql`1` })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, platformAccounts.userId),
            sql`${sessions.updatedAt} > ${ago(ACTIVE_WITHIN_MS)}`,
          ),
        ),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(users)
        .where(and(eq(users.id, platformAccounts.userId), eq(users.publicProfile, true))),
    ),
  );

  return and(
    // Extension platforms only update when the user runs the extension.
    inArray(platformAccounts.platform, [...SYNCED_PLATFORMS]),
    olderThan(platformAccounts.lastSyncedAt, STALE_AFTER_MS),
    // Not mid-sync, unless the sync looks stuck.
    or(
      sql`${platformAccounts.status} <> 'syncing'`,
      olderThan(platformAccounts.syncRequestedAt, SYNC_STALE_MS),
    ),
    // Not requested recently either, so a failing account is retried daily rather than every run.
    olderThan(platformAccounts.syncRequestedAt, STALE_AFTER_MS),
    activeUser,
  )!;
}

/** Atomically marks every stale account of an active user as syncing and returns them. */
export async function claimStaleAccounts(opts: { now?: Date } = {}): Promise<ClaimedAccount[]> {
  const claimed = await db
    .update(platformAccounts)
    .set({ status: "syncing", syncRequestedAt: sql`now()`, lastError: null })
    .where(staleAccountsWhere(opts.now))
    .returning({ accountId: platformAccounts.id, platform: platformAccounts.platform });
  return claimed as ClaimedAccount[];
}
