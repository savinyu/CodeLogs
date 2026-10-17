"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { dailyMarks } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";

export type PickDoneState = { ok: true } | { ok: false; error: string };

const input = z.object({
  platform: z.enum(["codeforces", "leetcode", "atcoder"]),
  externalId: z.string().min(1).max(64),
  done: z.boolean(),
});

/** Mark a Today pick done (or undo it) for the current UTC day. */
export async function setPickDone(raw: unknown): Promise<PickDoneState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to mark picks done." };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid pick." };
  const { platform, externalId, done } = parsed.data;
  const day = new Date().toISOString().slice(0, 10);

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
  refresh();
  return { ok: true };
}
