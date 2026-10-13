// Dashboard reads. Every query on user data is scoped by userId; aggregate.ts does the shaping.

import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
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
import { addDays, buildDashboard, HEATMAP_DAYS, type DashboardRaw } from "./aggregate";
import type { DashboardData, DifficultyBand } from "./types";

export const RECENT_LIMIT = 15;

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
  const from = addDays(asOf, -(HEATMAP_DAYS - 1));
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
      .where(
        and(eq(solves.userId, userId), gte(solves.firstSolvedAt, new Date(`${from}T00:00:00Z`))),
      )
      .groupBy(problems.platform, solvedDay),
    db
      .select({
        platform: platformAccounts.platform,
        day: activityDays.day,
        count: activityDays.count,
      })
      .from(activityDays)
      .innerJoin(platformAccounts, eq(platformAccounts.id, activityDays.accountId))
      .where(and(eq(platformAccounts.userId, userId), gte(activityDays.day, from))),
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
        platform: problems.platform,
        externalId: problems.externalId,
        title: problems.title,
        url: problems.url,
        solvedAt: solves.firstSolvedAt,
        difficultyRaw: problems.difficultyRaw,
        difficultyNorm: problems.difficultyNorm,
        tags: problems.rawTags,
      })
      .from(solves)
      .innerJoin(problems, eq(problems.id, solves.problemId))
      .where(eq(solves.userId, userId))
      .orderBy(sql`${solves.firstSolvedAt} DESC NULLS LAST`, desc(solves.id))
      .limit(RECENT_LIMIT),
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
      recent: recent.map((r) => ({
        ...r,
        solvedAt: r.solvedAt?.toISOString() ?? null,
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
