import "server-only";
import { cron } from "inngest";
import type { PlatformId } from "@/lib/adapters/types";
import { catalogSyncEvent, inngest } from "../client";

/** Codeforces and AtCoder refresh daily; LeetCode only on Sundays (PLAN §4). */
export function catalogPlatformsFor(date: Date): PlatformId[] {
  const platforms: PlatformId[] = ["codeforces", "atcoder"];
  if (date.getUTCDay() === 0) platforms.push("leetcode");
  return platforms;
}

export const syncCatalogs = inngest.createFunction(
  {
    id: "sync-catalogs",
    name: "Daily catalog refresh",
    triggers: [cron("0 3 * * *")],
  },
  async ({ step }) => {
    const platforms = catalogPlatformsFor(new Date());
    await step.sendEvent(
      "fan-out",
      platforms.map((platform) => catalogSyncEvent.create({ platform })),
    );
    return { queued: platforms };
  },
);
