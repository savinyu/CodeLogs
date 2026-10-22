import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { platformAccounts } from "@/lib/db/schema";
import { validateHandle } from "@/lib/adapters/validate";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";
import type { PlatformId, SyncedPlatformId } from "@/lib/adapters/types";

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
/** The user's connected platforms whose handles aren't verified, in PLATFORM_ORDER. */
export async function listUnverifiedPlatforms(userId: string): Promise<PlatformId[]> {
  const rows = await db
    .select({ platform: platformAccounts.platform })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.verified, false)));
  return PLATFORM_ORDER.filter((id) => rows.some((r) => r.platform === id));
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

export type ConnectLoggedInResult =
  { ok: true; id: string; handle: string } | { ok: false; status: 400 | 409 | 503; error: string };

/**
 * Connects the Codeforces, AtCoder or LeetCode user the extension saw this browser logged in as,
 * for a user with no handle there yet. It is verified from the start: the login is the proof
 * (PLAN-v2.md §9). The platform confirms the handle exists and gives its casing, as on Connect.
 * The caller queues the first sync.
 */
export async function connectLoggedInHandle(
  userId: string,
  platform: SyncedPlatformId,
  loggedInAs: string,
): Promise<ConnectLoggedInResult> {
  const name = PLATFORM_META[platform].name;
  const validation = await validateHandle(platform, loggedInAs);
  if (validation.result === "retry") {
    return {
      ok: false,
      status: 503,
      error: `Couldn't reach ${name} to check your handle. Try again later.`,
    };
  }
  if (validation.result === "invalid") {
    return {
      ok: false,
      status: 400,
      error: `The extension read an unexpected ${name} username (${loggedInAs}).`,
    };
  }

  // The unique (user_id, platform) index settles a race with Connect or a second request.
  const [row] = await db
    .insert(platformAccounts)
    .values({ userId, platform, handle: validation.canonicalHandle, verified: true })
    .onConflictDoNothing()
    .returning({ id: platformAccounts.id, handle: platformAccounts.handle });
  if (!row) {
    return {
      ok: false,
      status: 409,
      error: `A ${name} handle was just connected to your account. Try again.`,
    };
  }
  return { ok: true, ...row };
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
