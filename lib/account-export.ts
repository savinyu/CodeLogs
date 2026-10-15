import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityDays,
  platformAccounts,
  platformStats,
  problems,
  socialLinks,
  solves,
  users,
} from "@/lib/db/schema";

/** Everything we hold about one user, as plain JSON. Never includes tokens, sessions or raw payloads. */
export async function buildAccountExport(userId: string) {
  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      username: users.username,
      image: users.image,
      publicProfile: users.publicProfile,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;

  const [linkRows, accountRows, solveRows, dayRows, statRows] = await Promise.all([
    db
      .select({ kind: socialLinks.kind, value: socialLinks.value })
      .from(socialLinks)
      .where(eq(socialLinks.userId, userId))
      .orderBy(asc(socialLinks.kind)),
    db
      .select({
        platform: platformAccounts.platform,
        handle: platformAccounts.handle,
        verified: platformAccounts.verified,
        status: platformAccounts.status,
        historyComplete: platformAccounts.historyComplete,
        lastSyncedAt: platformAccounts.lastSyncedAt,
        createdAt: platformAccounts.createdAt,
      })
      .from(platformAccounts)
      .where(eq(platformAccounts.userId, userId))
      .orderBy(asc(platformAccounts.platform)),
    db
      .select({
        platform: problems.platform,
        externalId: problems.externalId,
        title: problems.title,
        url: problems.url,
        difficultyRaw: problems.difficultyRaw,
        firstSolvedAt: solves.firstSolvedAt,
        source: solves.source,
      })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(eq(solves.userId, userId))
      .orderBy(sql`${solves.firstSolvedAt} asc nulls last`, asc(solves.id)),
    db
      .select({
        platform: platformAccounts.platform,
        day: activityDays.day,
        count: activityDays.count,
      })
      .from(activityDays)
      .innerJoin(platformAccounts, eq(platformAccounts.id, activityDays.accountId))
      .where(eq(platformAccounts.userId, userId))
      .orderBy(asc(platformAccounts.platform), asc(activityDays.day)),
    db
      .select({
        platform: platformAccounts.platform,
        kind: platformStats.kind,
        payload: platformStats.payload,
        fetchedAt: platformStats.fetchedAt,
      })
      .from(platformStats)
      .innerJoin(platformAccounts, eq(platformAccounts.id, platformStats.accountId))
      .where(eq(platformAccounts.userId, userId))
      .orderBy(asc(platformAccounts.platform), asc(platformStats.kind)),
  ]);

  return {
    format: "codelogs-export" as const,
    version: 1 as const,
    exportedAt: new Date(),
    user,
    socialLinks: linkRows,
    platformAccounts: accountRows,
    solves: solveRows,
    activityDays: dayRows,
    platformStats: statRows,
  };
}
