import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { platformAccounts, problems, sheetFollows, sheetTicks, solves } from "@/lib/db/schema";
import { followedSheets } from "./follow";
import type { SheetState } from "./types";

export interface LeetcodeSolvedSlugs {
  slugs: Set<string>;
  /** Whether the LeetCode account's full history is imported; null without a LeetCode account. */
  historyComplete: boolean | null;
}

/** The user's known LeetCode solves (every source), for sheet progress. */
export async function getLeetcodeSolvedSlugs(userId: string): Promise<LeetcodeSolvedSlugs> {
  const [rows, [account]] = await Promise.all([
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
  ]);
  return {
    slugs: new Set(rows.map((r) => r.slug)),
    historyComplete: account?.historyComplete ?? null,
  };
}

/** Solves, ticks and follows in one go: everything a page needs to show sheets. */
export async function getSheetState(userId: string): Promise<SheetState> {
  const [{ slugs, historyComplete }, ticks, follows] = await Promise.all([
    getLeetcodeSolvedSlugs(userId),
    db.select({ slug: sheetTicks.slug }).from(sheetTicks).where(eq(sheetTicks.userId, userId)),
    db
      .select({ sheetId: sheetFollows.sheetId, following: sheetFollows.following })
      .from(sheetFollows)
      .where(eq(sheetFollows.userId, userId)),
  ]);
  return {
    solvedSlugs: slugs,
    tickedSlugs: new Set(ticks.map((t) => t.slug)),
    followed: followedSheets(new Map(follows.map((f) => [f.sheetId, f.following]))),
    historyComplete,
  };
}
