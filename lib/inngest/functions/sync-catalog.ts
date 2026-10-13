import "server-only";
import { CATALOGS } from "@/lib/adapters";
import { failCatalogSync, finishCatalogSync, startCatalogSync } from "@/lib/sync/runs";
import { upsertCatalog } from "@/lib/sync/upsert";
import { catalogSyncEvent, inngest } from "../client";

const PLATFORM_CONCURRENCY = { scope: "env", key: "event.data.platform", limit: 1 } as const;

export const syncCatalog = inngest.createFunction(
  {
    id: "sync-catalog",
    name: "Refresh a platform's problem catalog",
    triggers: [catalogSyncEvent],
    // Same scope, key and limit as sync-account.ts: catalog and account syncs for one platform
    // never run at the same time.
    concurrency: [PLATFORM_CONCURRENCY],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const platform = (event.data.event.data as { platform?: unknown }).platform;
      if (platform !== "codeforces" && platform !== "atcoder" && platform !== "leetcode") return;
      await failCatalogSync({ platform, error: error.message });
    },
  },
  async ({ event, step }) => {
    const { platform } = event.data;
    const id = await step.run("start", () => startCatalogSync(platform));
    const rows = await step.run("fetch-and-upsert", async () => {
      const problems = await CATALOGS[platform].fetchCatalog();
      await upsertCatalog(platform, problems);
      return problems.length;
    });
    await step.run("finish", () => finishCatalogSync(id, rows));
    return { platform, rows };
  },
);
