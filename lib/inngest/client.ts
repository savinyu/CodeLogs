// The Inngest client and the typed events this app sends. The SDK reads INNGEST_EVENT_KEY,
// INNGEST_SIGNING_KEY and INNGEST_DEV straight from process.env (see .env.example).

import { Inngest, eventType, staticSchema } from "inngest";
import type { SyncedPlatformId } from "@/lib/adapters/types";

export const inngest = new Inngest({ id: "logn" });

/** Sync one connected platform account. */
export const accountSyncEvent = eventType("account/sync", {
  schema: staticSchema<{ accountId: string; platform: SyncedPlatformId }>(),
});

/** Refresh one platform's problem catalog. */
export const catalogSyncEvent = eventType("catalog/sync", {
  schema: staticSchema<{ platform: SyncedPlatformId }>(),
});
