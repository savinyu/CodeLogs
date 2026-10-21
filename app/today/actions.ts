"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { userDataChanged } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { dailyMarks } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { isWithinOneDay } from "@/lib/today/day";

export type PickDoneState = { ok: true } | { ok: false; error: string };

const input = z.object({
  platform: z.enum(["codeforces", "leetcode", "atcoder"]),
  externalId: z.string().min(1).max(64),
  done: z.boolean(),
  /** The day the page is showing (YYYY-MM-DD). */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Mark a Today pick done (or undo it) for the UTC day the page shows (within a day of now). */
export async function setPickDone(raw: unknown): Promise<PickDoneState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to mark picks done." };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid pick." };
  const { platform, externalId, done, day } = parsed.data;
  if (!isWithinOneDay(day, Date.now())) {
    return { ok: false, error: "This page is out of date. Reload to see today's set." };
  }

  try {
    if (done) {
      await db
        .insert(dailyMarks)
        .values({ userId: user.id, day, platform, externalId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(dailyMarks)
        .where(
          and(
            eq(dailyMarks.userId, user.id),
            eq(dailyMarks.day, day),
            eq(dailyMarks.platform, platform),
            eq(dailyMarks.externalId, externalId),
          ),
        );
    }
  } catch {
    return { ok: false, error: "Could not save that. Try again." };
  }
  userDataChanged(user.id);
  return { ok: true };
}
