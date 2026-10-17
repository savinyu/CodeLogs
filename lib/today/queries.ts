import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyMarks } from "@/lib/db/schema";

/** The picks the user marked done on a UTC day (YYYY-MM-DD), as "platform:externalId". */
export async function getDailyMarks(userId: string, day: string): Promise<Set<string>> {
  const rows = await db
    .select({ platform: dailyMarks.platform, externalId: dailyMarks.externalId })
    .from(dailyMarks)
    .where(and(eq(dailyMarks.userId, userId), eq(dailyMarks.day, day)));
  return new Set(rows.map((r) => `${r.platform}:${r.externalId}`));
}
