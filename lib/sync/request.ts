import "server-only";
import type { SyncedPlatformId } from "@/lib/adapters/types";
import { accountSyncEvent, inngest } from "@/lib/inngest/client";
import { claimAccountsForSync, releaseClaim } from "./runs";

export type RequestSyncResult = { ok: true; queued: number } | { ok: false; error: string };

const QUEUE_ERROR = "Couldn't queue the sync. Is the Inngest dev server running?";

/**
 * Claims the user's accounts (skipping ones inside the cooldown or already syncing) and sends
 * one account/sync event per claim. Never throws: a failed send releases the claim and returns an error.
 */
export async function requestSync(
  userId: string,
  opts: { platforms?: SyncedPlatformId[]; ignoreCooldown?: boolean } = {},
): Promise<RequestSyncResult> {
  const claimed = await claimAccountsForSync(userId, opts);
  if (claimed.length === 0) return { ok: true, queued: 0 };

  try {
    await inngest.send(
      claimed.map(({ accountId, platform }) => accountSyncEvent.create({ accountId, platform })),
    );
  } catch (err) {
    console.error("Failed to send account/sync events", err);
    await releaseClaim(
      claimed.map((c) => c.accountId),
      QUEUE_ERROR,
    ).catch((releaseErr) => console.error("Failed to release sync claim", releaseErr));
    return { ok: false, error: QUEUE_ERROR };
  }
  return { ok: true, queued: claimed.length };
}

/**
 * The first sync of a handle the extension just connected. Best effort, as on Connect: on a
 * failure the handle stays connected and the daily stale-account sync picks it up.
 */
export async function requestFirstSync(userId: string, platform: SyncedPlatformId): Promise<void> {
  try {
    const result = await requestSync(userId, { platforms: [platform], ignoreCooldown: true });
    if (!result.ok) console.error(`First ${platform} sync not queued: ${result.error}`);
  } catch (err) {
    console.error(`First ${platform} sync not queued`, err);
  }
}
