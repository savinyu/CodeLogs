import "server-only";
import { cron } from "inngest";
import { claimStaleAccounts } from "@/lib/sync/stale";
import { accountSyncEvent, inngest } from "../client";

const SEND_CHUNK = 500;

/**
 * Re-syncs accounts that haven't synced in ~a day, for active users. This is also the once-a-day
 * LeetCode sync and keeps its backfill complete (LeetCode exposes only the last 20 solves).
 * Per-platform politeness comes from syncAccount's concurrency limit, so fanning out is fine.
 */
export const syncStaleAccounts = inngest.createFunction(
  {
    id: "sync-stale-accounts",
    name: "Daily sync of stale accounts",
    triggers: [cron("0 4 * * *")],
  },
  async ({ step }) => {
    const claimed = await step.run("claim", async () => {
      const rows = await claimStaleAccounts();
      return rows.map(({ accountId, platform }) => ({ accountId, platform }));
    });
    if (claimed.length === 0) return { queued: 0 };

    // If a send throws, the claimed accounts sit in `syncing` until the stuck-sync rule
    // (SYNC_STALE_MS) frees them; the next run then picks them up again.
    for (let i = 0; i < claimed.length; i += SEND_CHUNK) {
      await step.sendEvent(
        `fan-out-${i / SEND_CHUNK}`,
        claimed.slice(i, i + SEND_CHUNK).map((c) => accountSyncEvent.create(c)),
      );
    }
    return { queued: claimed.length };
  },
);
