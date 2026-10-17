import "server-only";
import { asc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { friendRelation } from "@/lib/account-export-shared";
import { db } from "@/lib/db/client";
import {
  activityDays,
  contestResults,
  dailyMarks,
  friendships,
  platformAccounts,
  platformStats,
  problems,
  sheetFollows,
  sheetTicks,
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
      globalBoard: users.globalBoard,
      dailyGoal: users.dailyGoal,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;

  const requester = alias(users, "requester");
  const addressee = alias(users, "addressee");

  const [
    linkRows,
    accountRows,
    solveRows,
    dayRows,
    statRows,
    contestRows,
    markRows,
    followRows,
    tickRows,
    friendRows,
  ] = await Promise.all([
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
    db
      .select({
        platform: platformAccounts.platform,
        contestKey: contestResults.contestKey,
        name: contestResults.name,
        heldAt: contestResults.heldAt,
        rank: contestResults.rank,
        oldRating: contestResults.oldRating,
        newRating: contestResults.newRating,
        rated: contestResults.rated,
      })
      .from(contestResults)
      .innerJoin(platformAccounts, eq(platformAccounts.id, contestResults.accountId))
      .where(eq(platformAccounts.userId, userId))
      .orderBy(asc(platformAccounts.platform), asc(contestResults.heldAt)),
    db
      .select({
        day: dailyMarks.day,
        platform: dailyMarks.platform,
        externalId: dailyMarks.externalId,
      })
      .from(dailyMarks)
      .where(eq(dailyMarks.userId, userId))
      .orderBy(asc(dailyMarks.day), asc(dailyMarks.platform), asc(dailyMarks.externalId)),
    db
      .select({ sheetId: sheetFollows.sheetId, following: sheetFollows.following })
      .from(sheetFollows)
      .where(eq(sheetFollows.userId, userId))
      .orderBy(asc(sheetFollows.sheetId)),
    db
      .select({ slug: sheetTicks.slug, createdAt: sheetTicks.createdAt })
      .from(sheetTicks)
      .where(eq(sheetTicks.userId, userId))
      .orderBy(asc(sheetTicks.slug)),
    // Only usernames are selected, never another user's id or email.
    db
      .select({
        requesterId: friendships.requesterId,
        status: friendships.status,
        requesterName: requester.username,
        addresseeName: addressee.username,
        createdAt: friendships.createdAt,
        acceptedAt: friendships.acceptedAt,
      })
      .from(friendships)
      .innerJoin(requester, eq(requester.id, friendships.requesterId))
      .innerJoin(addressee, eq(addressee.id, friendships.addresseeId))
      .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)))
      .orderBy(asc(friendships.createdAt)),
  ]);

  const friends = friendRows.map((r) => ({
    username: r.requesterId === userId ? r.addresseeName : r.requesterName,
    status: friendRelation(r, userId),
    since: r.status === "accepted" ? (r.acceptedAt ?? r.createdAt) : r.createdAt,
  }));

  return {
    format: "codelogs-export" as const,
    version: 1 as const,
    exportedAt: new Date(),
    user: {
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
      publicProfile: user.publicProfile,
      createdAt: user.createdAt,
    },
    settings: {
      dailyGoal: user.dailyGoal,
      globalBoard: user.globalBoard,
      publicProfile: user.publicProfile,
    },
    socialLinks: linkRows,
    platformAccounts: accountRows,
    solves: solveRows,
    activityDays: dayRows,
    platformStats: statRows,
    contestResults: contestRows,
    dailyMarks: markRows,
    sheetFollows: followRows,
    sheetTicks: tickRows,
    friends,
  };
}
