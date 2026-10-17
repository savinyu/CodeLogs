import "server-only";
import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { userTag } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { platformAccounts, problems, sheetFollows, sheetTicks, solves } from "@/lib/db/schema";
import { followedSheets } from "./follow";
import type { SheetState } from "./types";

/** Solves, ticks and follows in one go: everything a page needs to show sheets. */
export async function getSheetState(userId: string): Promise<SheetState> {
  "use cache: remote";
  cacheLife("user");
  cacheTag(userTag(userId));
  // The user's known LeetCode solves (every source), the LeetCode account, ticks and follows,
  // in one round trip.
  const [solved, [account], ticks, follows] = await db.batch([
    db
      .select({ slug: problems.externalId })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(and(eq(solves.userId, userId), eq(problems.platform, "leetcode"))),
    db
      .select({ historyComplete: platformAccounts.historyComplete })
      .from(platformAccounts)
      .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.platform, "leetcode")))
      .limit(1),
    db.select({ slug: sheetTicks.slug }).from(sheetTicks).where(eq(sheetTicks.userId, userId)),
    db
      .select({ sheetId: sheetFollows.sheetId, following: sheetFollows.following })
      .from(sheetFollows)
      .where(eq(sheetFollows.userId, userId)),
  ]);
  return {
    solvedSlugs: new Set(solved.map((r) => r.slug)),
    tickedSlugs: new Set(ticks.map((t) => t.slug)),
    followed: followedSheets(new Map(follows.map((f) => [f.sheetId, f.following]))),
    // Whether the LeetCode account's full history is imported; null without a LeetCode account.
    historyComplete: account?.historyComplete ?? null,
  };
}
