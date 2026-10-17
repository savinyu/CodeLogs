import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { platformAccounts } from "@/lib/db/schema";
import { PLATFORM_META } from "@/lib/platforms";
import type { PlatformId } from "@/lib/adapters/types";

export type PlatformAccountRow = {
  platform: PlatformId;
  handle: string;
  status: "pending" | "syncing" | "ok" | "partial" | "error";
  verified: boolean;
  /** The code the user pastes into their profile to verify the handle; null until requested. */
  verifyToken: string | null;
  historyComplete: boolean;
  lastSyncedAt: Date | null;
  lastError: string | null;
  syncRequestedAt: Date | null;
  createdAt: Date;
};

export type AccountMutationResult = { ok: true } | { ok: false; error: string };

export async function listPlatformAccounts(userId: string): Promise<PlatformAccountRow[]> {
  return db
    .select({
      platform: platformAccounts.platform,
      handle: platformAccounts.handle,
      status: platformAccounts.status,
      verified: platformAccounts.verified,
      verifyToken: platformAccounts.verifyToken,
      historyComplete: platformAccounts.historyComplete,
      lastSyncedAt: platformAccounts.lastSyncedAt,
      lastError: platformAccounts.lastError,
      syncRequestedAt: platformAccounts.syncRequestedAt,
      createdAt: platformAccounts.createdAt,
    })
    .from(platformAccounts)
    .where(eq(platformAccounts.userId, userId))
    .orderBy(asc(platformAccounts.createdAt));
}

/**
 * Inserts a new account. Never upserts: replacing a handle must drop the old solves, so the
 * user removes the current one first (the FK cascade on delete clears its data).
 */
/** Connected handles not verified yet: the public profile hides them. */
export async function countUnverifiedAccounts(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.verified, false)));
  return row?.n ?? 0;
}

export async function addPlatformAccount(
  userId: string,
  platform: PlatformId,
  handle: string,
): Promise<AccountMutationResult> {
  const name = PLATFORM_META[platform].name;
  const alreadyThere = `Remove your current ${name} handle first.`;

  const [existing] = await db
    .select({ id: platformAccounts.id })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.platform, platform)))
    .limit(1);
  if (existing) return { ok: false, error: alreadyThere };

  // The unique (user_id, platform) index settles a race between two concurrent adds.
  const inserted = await db
    .insert(platformAccounts)
    .values({ userId, platform, handle })
    .onConflictDoNothing()
    .returning({ id: platformAccounts.id });
  if (inserted.length === 0) return { ok: false, error: alreadyThere };
  return { ok: true };
}

export async function removePlatformAccount(
  userId: string,
  platform: PlatformId,
): Promise<AccountMutationResult> {
  await db
    .delete(platformAccounts)
    .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.platform, platform)));
  return { ok: true };
}
