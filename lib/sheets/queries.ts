import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { platformAccounts, problems, solves } from "@/lib/db/schema";

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
