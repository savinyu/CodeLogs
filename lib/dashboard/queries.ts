// Dashboard reads. Every query on user data is scoped by userId; aggregate.ts does the shaping.

import "server-only";
import { and, count, eq, isNotNull, lte, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "@/lib/db/client";
import {
  activityDays,
  platformAccounts,
  platformStats,
  problems,
  solves,
  users,
} from "@/lib/db/schema";
import type { PlatformId } from "@/lib/adapters/types";
import { ratingOf } from "@/lib/topics/recommend";
import { cfCatalogCap, type TagSetCount } from "@/lib/topics/scoring";
import { buildDashboard, codeforcesLevel, RECENT_LIMIT, type DashboardRaw } from "./aggregate";
import type { DashboardData, DifficultyBand } from "./types";

/** Tag frequencies across each platform's whole catalog. Global and slow-moving, so cached. */
async function getCatalogTags(): Promise<DashboardRaw["catalogTags"]> {
  "use cache";
  cacheLife("days");
  const result = await db.execute<{ platform: PlatformId; tag: string; count: number }>(sql`
    SELECT p.platform, t.tag, count(*)::int AS count
    FROM ${problems} p CROSS JOIN LATERAL jsonb_array_elements_text(p.raw_tags) AS t(tag)
    GROUP BY 1, 2`);
  return result.rows;
}

/**
 * Catalog problems grouped by identical tag sets, for topic expectations. Codeforces: rated
 * problems up to `maxRating`. LeetCode: free problems only (paid ones are rarely solvable).
 */
async function getCatalogTagSets(
  platform: "codeforces" | "leetcode",
  maxRating: number,
): Promise<TagSetCount[]> {
  "use cache";
  cacheLife("days");
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

async function getSolvedTags(userId: string): Promise<DashboardRaw["solvedTags"]> {
  const result = await db.execute<{ platform: PlatformId; tag: string; count: number }>(sql`
    SELECT p.platform, t.tag, count(*)::int AS count
    FROM ${solves} s
    JOIN ${problems} p ON p.id = s.problem_id
    CROSS JOIN LATERAL jsonb_array_elements_text(p.raw_tags) AS t(tag)
    WHERE s.user_id = ${userId}
    GROUP BY 1, 2`);
  return result.rows;
}

/** Call after reading the request (session or params): it uses the current time. */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const asOf = new Date().toISOString().slice(0, 10);
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
    .where(eq(solves.userId, userId))
    .as("ranked");
  const solvedDay = sql<string>`to_char(${solves.firstSolvedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

  const [
    accounts,
    solveCounts,
    stats,
    solveDays,
    calendarDays,
    difficulty,
    solvedTags,
    catalogTags,
    recent,
    cfSolves,
  ] = await Promise.all([
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
      .where(eq(platformAccounts.userId, userId)),
    db
      .select({ platform: problems.platform, count: count() })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(eq(solves.userId, userId))
      .groupBy(problems.platform),
    db
      .select({
        platform: platformAccounts.platform,
        kind: platformStats.kind,
        payload: platformStats.payload,
      })
      .from(platformStats)
      .innerJoin(platformAccounts, eq(platformAccounts.id, platformStats.accountId))
      .where(eq(platformAccounts.userId, userId)),
    db
      .select({ platform: problems.platform, day: solvedDay, count: count() })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(and(eq(solves.userId, userId), isNotNull(solves.firstSolvedAt)))
      .groupBy(problems.platform, solvedDay),
    db
      .select({
        platform: platformAccounts.platform,
        day: activityDays.day,
        count: activityDays.count,
      })
      .from(activityDays)
      .innerJoin(platformAccounts, eq(platformAccounts.id, activityDays.accountId))
      .where(eq(platformAccounts.userId, userId)),
    db
      .select({ platform: problems.platform, band: problems.difficultyNorm, count: count() })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(eq(solves.userId, userId))
      .groupBy(problems.platform, problems.difficultyNorm),
    getSolvedTags(userId),
    getCatalogTags(),
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
      .where(and(eq(solves.userId, userId), eq(problems.platform, "codeforces"))),
  ]);

  // The CF catalog slice depends on the user's level, so it's a second (cached) round trip.
  const level = codeforcesLevel({ accounts, stats, cfSolves });
  const [cfCatalog, lcCatalog] = await Promise.all([
    level === null ? [] : getCatalogTagSets("codeforces", cfCatalogCap(level)),
    accounts.some((a) => a.platform === "leetcode") ? getCatalogTagSets("leetcode", 0) : [],
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
      solvedTags,
      catalogTags,
      cfSolves,
      cfCatalog,
      lcCatalog,
      recent: recent.map((r) => ({
        ...r,
        solvedAt: r.solvedAt ? new Date(r.solvedAt).toISOString() : null,
        difficultyNorm: (r.difficultyNorm as DifficultyBand | null) ?? null,
      })),
    },
    asOf,
  );
}

export interface PublicProfile {
  userId: string;
  name: string;
  username: string;
  image: string | null;
}

/** A user whose profile is public, by username (case-insensitive); null otherwise. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select({ userId: users.id, name: users.name, username: users.username, image: users.image })
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
