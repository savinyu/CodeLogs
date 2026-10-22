import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { platformAccounts, platformOptOuts } from "@/lib/db/schema";
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
 * The user's connected platforms whose handles aren't verified, in PLATFORM_ORDER. The public
 * profile hides them.
 */
export async function listUnverifiedPlatforms(userId: string): Promise<PlatformId[]> {
  const rows = await db
    .select({ platform: platformAccounts.platform })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.verified, false)));
  return PLATFORM_ORDER.filter((id) => rows.some((r) => r.platform === id));
}

/** The platforms the user removed on Connect and hasn't connected again, in PLATFORM_ORDER. */
export async function listRemovedPlatforms(userId: string): Promise<PlatformId[]> {
  const rows = await db
    .select({ platform: platformOptOuts.platform })
    .from(platformOptOuts)
    .where(eq(platformOptOuts.userId, userId));
  return PLATFORM_ORDER.filter((id) => rows.some((r) => r.platform === id));
}

async function isPlatformRemoved(userId: string, platform: PlatformId): Promise<boolean> {
  const [row] = await db
    .select({ platform: platformOptOuts.platform })
    .from(platformOptOuts)
    .where(optOutWhere(userId, platform))
    .limit(1);
  return row !== undefined;
}

function optOutWhere(userId: string, platform: PlatformId) {
  return and(eq(platformOptOuts.userId, userId), eq(platformOptOuts.platform, platform));
}

/**
 * Why an automatic extension sync didn't connect a platform the user removed. The extension
 * itself skips these, so only an older extension (or a race with Remove) sees it.
 */
export function removedPlatformError(platform: PlatformId): string {
  const name = PLATFORM_META[platform].name;
  return `You removed ${name} from LogN, so the extension doesn't add it back on its own. Add it on the LogN Connect page, or click its row in an up-to-date extension.`;
}

/**
 * Inserts a new account. Never upserts: replacing a handle must drop the old solves, so the
 * user removes the current one first (the FK cascade on delete clears its data). Typing a handle
 * undoes a removal.
 */
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
  const [inserted] = await db.batch([
    db
      .insert(platformAccounts)
      .values({ userId, platform, handle })
      .onConflictDoNothing()
      .returning({ id: platformAccounts.id }),
    db.delete(platformOptOuts).where(optOutWhere(userId, platform)),
  ]);
  if (inserted.length === 0) return { ok: false, error: alreadyThere };
  return { ok: true };
}

/**
 * Inserts the verified handle the extension saw this browser logged in as. A `manual` connect
 * (the user clicked the platform in the extension) also undoes a removal. An automatic one checks
 * for a removal in the insert itself, so a Remove that commits while the upload is in flight
 * still wins. "exists" when a handle is already connected (the unique (user_id, platform) index
 * settles a race).
 */
export async function insertLoggedInAccount(
  userId: string,
  platform: PlatformId,
  handle: string,
  manual: boolean,
): Promise<{ id: string; handle: string } | "exists" | "removed"> {
  if (manual) {
    const [rows] = await db.batch([
      db
        .insert(platformAccounts)
        .values({ userId, platform, handle, verified: true })
        .onConflictDoNothing()
        .returning({ id: platformAccounts.id, handle: platformAccounts.handle }),
      db.delete(platformOptOuts).where(optOutWhere(userId, platform)),
    ]);
    return rows[0] ?? "exists";
  }
  const { rows } = await db.execute<{ id: string; handle: string }>(sql`
    insert into ${platformAccounts} (user_id, platform, handle, verified)
    select ${userId}::text, ${platform}::platform, ${handle}::text, true
    where not exists (
      select 1 from ${platformOptOuts} where user_id = ${userId} and platform = ${platform}::platform
    )
    on conflict do nothing
    returning id, handle`);
  if (rows[0]) return rows[0];
  return (await isPlatformRemoved(userId, platform)) ? "removed" : "exists";
}

/**
 * Whether an extension upload may connect `platform`: always when the user clicked it
 * (`manual`), otherwise only when they didn't remove it on Connect. An early check, so a removed
 * platform isn't looked up on its site; insertLoggedInAccount checks again atomically.
 */
export async function mayConnectFromExtension(
  userId: string,
  platform: PlatformId,
  manual: boolean,
): Promise<boolean> {
  return manual || !(await isPlatformRemoved(userId, platform));
}

export type ConnectLoggedInResult =
  { ok: true; id: string; handle: string } | { ok: false; status: 400 | 409 | 503; error: string };

/**
 * Connects the Codeforces, AtCoder or LeetCode user the extension saw this browser logged in as,
 * for a user with no handle there yet. It is verified from the start: the login is the proof
 * (PLAN-v2.md §9). The platform confirms the handle exists and gives its casing, as on Connect.
 * Without `manual`, a platform the user removed stays removed. The caller queues the first sync.
 */
export async function connectLoggedInHandle(
  userId: string,
  platform: SyncedPlatformId,
  loggedInAs: string,
  manual: boolean,
): Promise<ConnectLoggedInResult> {
  if (!(await mayConnectFromExtension(userId, platform, manual))) {
    return { ok: false, status: 409, error: removedPlatformError(platform) };
  }
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

  const row = await insertLoggedInAccount(userId, platform, validation.canonicalHandle, manual);
  if (row === "removed") return { ok: false, status: 409, error: removedPlatformError(platform) };
  if (row === "exists") {
    return {
      ok: false,
      status: 409,
      error: `A ${name} handle was just connected to your account. Try again.`,
    };
  }
  return { ok: true, ...row };
}

/**
 * Deletes the handle (its solves cascade) and records the removal, in one transaction, so the
 * extension's automatic syncs don't connect the platform again.
 */
export async function removePlatformAccount(
  userId: string,
  platform: PlatformId,
): Promise<AccountMutationResult> {
  await db.batch([
    db
      .delete(platformAccounts)
      .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.platform, platform))),
    db.insert(platformOptOuts).values({ userId, platform }).onConflictDoNothing(),
  ]);
  return { ok: true };
}
