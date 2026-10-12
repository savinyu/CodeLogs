import "server-only";
import { ADAPTERS } from "@/lib/adapters";
import { failAccountSync, finishAccountSync, startAccountSync } from "@/lib/sync/runs";
import { applySnapshot } from "@/lib/sync/upsert";
import { accountSyncEvent, inngest } from "../client";
import { runAccountSync, type AccountSyncDeps } from "./sync-account-core";

const deps: AccountSyncDeps = {
  startAccountSync,
  finishAccountSync,
  applySnapshot,
  getAdapter: (platform) => ADAPTERS[platform],
};

export const syncAccount = inngest.createFunction(
  {
    id: "sync-account",
    name: "Sync a platform account",
    triggers: [accountSyncEvent],
    // One sync per platform at a time across all users (API politeness). The key expression
    // must stay identical to the one in sync-catalog.ts so both functions share a queue.
    concurrency: [{ scope: "env", key: "event.data.platform", limit: 1 }],
    retries: 3,
    onFailure: async ({ event, error }) => {
      const accountId = (event.data.event.data as { accountId?: unknown }).accountId;
      if (typeof accountId !== "string") return;
      await failAccountSync({ accountId, error: error.message });
    },
  },
  async ({ event, step }) =>
    runAccountSync(
      event.data.accountId,
      {
        // Step outputs are JSON round-tripped; the core only returns plain data.
        run: (id, fn) => step.run(id, fn) as ReturnType<typeof fn>,
        sleep: (id, ms) => step.sleep(id, ms),
      },
      deps,
    ),
);
