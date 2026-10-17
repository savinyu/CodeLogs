// The header's streak pill (v2): the current run of active UTC days, across every platform.

import "server-only";
import { and, eq, gt, gte, isNotNull, sql } from "drizzle-orm";
import { addDays } from "@/lib/dashboard/aggregate";
import { activityStats } from "@/lib/dashboard/heatmap";
import { db } from "@/lib/db/client";
import { activityDays, platformAccounts, solves } from "@/lib/db/schema";

export interface HeaderStreak {
  /** Days in the current streak; today counts once it has activity. */
  days: number;
  /** Whether today (UTC) has activity yet. */
  litToday: boolean;
}

/** Call after reading the session: it uses the current time. */
export async function getHeaderStreak(userId: string): Promise<HeaderStreak> {
  const asOf = new Date().toISOString().slice(0, 10);
  const since = addDays(asOf, -400);
  const solvedDay = sql<string>`to_char(${solves.firstSolvedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const [solveDays, calendarDays] = await Promise.all([
    db
      .selectDistinct({ day: solvedDay })
      .from(solves)
      .where(
        and(
          eq(solves.userId, userId),
          isNotNull(solves.firstSolvedAt),
          gte(solves.firstSolvedAt, new Date(`${since}T00:00:00Z`)),
        ),
      ),
    db
      .selectDistinct({ day: activityDays.day })
      .from(activityDays)
      .innerJoin(platformAccounts, eq(platformAccounts.id, activityDays.accountId))
      .where(
        and(
          eq(platformAccounts.userId, userId),
          gt(activityDays.count, 0),
          gte(activityDays.day, since),
        ),
      ),
  ]);
  const days = new Set([...solveDays, ...calendarDays].map((d) => d.day));
  const activity = [...days].map((day) => ({ day, counts: {}, total: 1 }));
  const { currentStreak } = activityStats(activity, { start: asOf, end: asOf }, asOf);
  return { days: currentStreak ?? 0, litToday: days.has(asOf) };
}
