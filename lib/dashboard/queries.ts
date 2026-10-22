// Dashboard reads. Every query on user data is scoped by userId; aggregate.ts does the shaping.

import "server-only";
import { and, count, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, userTag } from "@/lib/cache";
import { utcToday } from "@/lib/clock";
import { db } from "@/lib/db/client";
import {
  activityDays,
  contestResults,
  platformAccounts,
  platformStats,
  problems,
  solves,
  users,
} from "@/lib/db/schema";
import { ratingOf } from "@/lib/topics/recommend";
import { cfCatalogCap, type TagSetCount } from "@/lib/topics/scoring";
import { buildDashboard, codeforcesLevel, RECENT_LIMIT } from "./aggregate";
import type { DashboardData, DifficultyBand } from "./types";

/**
 * Catalog problems grouped by identical tag sets, for topic expectations. Codeforces: rated
 * problems up to `maxRating`. LeetCode: free problems only (paid ones are rarely solvable).
 */
async function getCatalogTagSets(
  platform: "codeforces" | "leetcode",
  maxRating: number,
): Promise<TagSetCount[]> {
  "use cache: remote";
  cacheLife("catalog");
  cacheTag(CATALOG_TAG);
  const filter =
    platform === "codeforces" ? sql`${ratingOf()} <= ${maxRating}` : sql`NOT ${problems.paidOnly}`;
  const result = await db.execute<{ tags: string[]; count: number }>(sql`
    SELECT ${problems.rawTags} AS tags, count(*)::int AS count
    FROM ${problems}
    WHERE ${problems.platform} = ${platform} AND ${problems.catalogUpdatedAt} IS NOT NULL
      AND ${filter}
    GROUP BY 1`);
  return result.rows;
}

export interface DashboardOptions {
  /** Public profiles: leave out handles the user hasn't verified, with all their data. */
  verifiedOnly?: boolean;
}

export async function getDashboardData(
  userId: string,
  { verifiedOnly = false }: DashboardOptions = {},
): Promise<DashboardData> {
  return loadDashboard(userId, verifiedOnly, await utcToday());
}

/** Cached per user and UTC day (`asOf`); every write to the user's rows drops it (lib/cache.ts). */
async function loadDashboard(
  userId: string,
  verifiedOnly: boolean,
  asOf: string,
): Promise<DashboardData> {
  "use cache: remote";
  cacheLife("user");
  cacheTag(userTag(userId));
  // Applied to every query: solves by their account, the rest through platform_accounts.
  const solvesFilter = verifiedOnly
    ? inArray(
        solves.accountId,
        db
          .select({ id: platformAccounts.id })
          .from(platformAccounts)
          .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.verified, true))),
      )
    : undefined;
  const accountsFilter = verifiedOnly ? eq(platformAccounts.verified, true) : undefined;
  // The newest RECENT_LIMIT solves per platform, so a platform filter still has a full list.
  const ranked = db
    .select({
      platform: problems.platform,
      externalId: problems.externalId,
      title: problems.title,
      url: problems.url,
      solvedAt: solves.firstSolvedAt,
      difficultyRaw: problems.difficultyRaw,
      difficultyNorm: problems.difficultyNorm,
      tags: problems.rawTags,
      rank: sql<number>`row_number() OVER (PARTITION BY ${problems.platform}
        ORDER BY ${solves.firstSolvedAt} DESC NULLS LAST, ${solves.id} DESC)`.as("rank"),
    })
    .from(solves)
    .innerJoin(problems, eq(problems.id, solves.problemId))
    .where(and(eq(solves.userId, userId), solvesFilter))
    .as("ranked");
  const solvedDay = sql<string>`to_char(${solves.firstSolvedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

  // One HTTP round trip to Neon for all ten reads, instead of ten.
  const [
    accounts,
    solveCounts,
    stats,
    solveDays,
    calendarDays,
    difficulty,
    recent,
    cfSolves,
    ibSolves,
    contests,
  ] = await db.batch([
    db
      .select({
        platform: platformAccounts.platform,
        handle: platformAccounts.handle,
        status: platformAccounts.status,
        verified: platformAccounts.verified,
        historyComplete: platformAccounts.historyComplete,
        lastSyncedAt: platformAccounts.lastSyncedAt,
      })
      .from(platformAccounts)
      .where(and(eq(platformAccounts.userId, userId), accountsFilter)),
    db
      .select({ platform: problems.platform, count: count() })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(and(eq(solves.userId, userId), solvesFilter))
      .groupBy(problems.platform),
    db
      .select({
        platform: platformAccounts.platform,
        kind: platformStats.kind,
        payload: platformStats.payload,
      })
      .from(platformStats)
      .innerJoin(platformAccounts, eq(platformAccounts.id, platformStats.accountId))
      .where(and(eq(platformAccounts.userId, userId), accountsFilter)),
    db
      .select({ platform: problems.platform, day: solvedDay, count: count() })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(and(eq(solves.userId, userId), solvesFilter, isNotNull(solves.firstSolvedAt)))
      .groupBy(problems.platform, solvedDay),
    db
      .select({
        platform: platformAccounts.platform,
        day: activityDays.day,
        count: activityDays.count,
      })
      .from(activityDays)
      .innerJoin(platformAccounts, eq(platformAccounts.id, activityDays.accountId))
      .where(and(eq(platformAccounts.userId, userId), accountsFilter)),
    db
      .select({ platform: problems.platform, band: problems.difficultyNorm, count: count() })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(and(eq(solves.userId, userId), solvesFilter))
      .groupBy(problems.platform, problems.difficultyNorm),
    db
      .select({
        platform: ranked.platform,
        externalId: ranked.externalId,
        title: ranked.title,
        url: ranked.url,
        solvedAt: ranked.solvedAt,
        difficultyRaw: ranked.difficultyRaw,
        difficultyNorm: ranked.difficultyNorm,
        tags: ranked.tags,
      })
      .from(ranked)
      .where(lte(ranked.rank, RECENT_LIMIT)),
    db
      .select({ tags: problems.rawTags, rating: problems.difficultyRaw })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(and(eq(solves.userId, userId), solvesFilter, eq(problems.platform, "codeforces"))),
    db
      .select({ tags: problems.rawTags })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(and(eq(solves.userId, userId), solvesFilter, eq(problems.platform, "interviewbit"))),
    db
      .select({
        platform: platformAccounts.platform,
        contestKey: contestResults.contestKey,
        name: contestResults.name,
        heldAt: contestResults.heldAt,
        rank: contestResults.rank,
        oldRating: contestResults.oldRating,
        newRating: contestResults.newRating,
      })
      .from(contestResults)
      .innerJoin(platformAccounts, eq(platformAccounts.id, contestResults.accountId))
      .where(and(eq(platformAccounts.userId, userId), accountsFilter)),
  ]);

  // The CF catalog slice depends on the user's level, so it's a second (cached) round trip.
  // InterviewBit's topic expectations borrow LeetCode's catalog (lib/topics/scoring.ts).
  const level = codeforcesLevel({ accounts, stats, cfSolves });
  const [cfCatalog, lcCatalog] = await Promise.all([
    level === null ? [] : getCatalogTagSets("codeforces", cfCatalogCap(level)),
    accounts.some((a) => a.platform === "leetcode" || a.platform === "interviewbit")
      ? getCatalogTagSets("leetcode", 0)
      : [],
  ]);

  return buildDashboard(
    {
      accounts: accounts.map((a) => ({
        ...a,
        lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
      })),
      solveCounts,
      stats,
      solveDays,
      calendarDays,
      difficulty,
      cfSolves,
      ibSolves,
      cfCatalog,
      lcCatalog,
      recent: recent.map((r) => ({
        ...r,
        solvedAt: r.solvedAt ? new Date(r.solvedAt).toISOString() : null,
        difficultyNorm: (r.difficultyNorm as DifficultyBand | null) ?? null,
      })),
      contests: contests.map((c) => ({ ...c, heldAt: c.heldAt.toISOString() })),
    },
    asOf,
  );
}

export interface PublicProfile {
  userId: string;
  name: string;
  username: string;
  /** The linked GitHub login, shown as the verified GitHub link. */
  githubLogin: string | null;
  image: string | null;
}

/** A user whose profile is public, by username (case-insensitive); null otherwise. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select({
      userId: users.id,
      name: users.name,
      username: users.username,
      githubLogin: users.githubLogin,
      image: users.image,
    })
    .from(users)
    .where(and(eq(users.username, username.toLowerCase()), eq(users.publicProfile, true)))
    .limit(1);
  if (!row?.username) return null;
  return { ...row, username: row.username };
}

export async function getPublicProfileSetting(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ publicProfile: users.publicProfile })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.publicProfile ?? false;
}
