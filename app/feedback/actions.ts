"use server";

import { createHmac } from "node:crypto";
import { eq, gt, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { feedbackLimitError, parseFeedback, type FeedbackParse } from "@/lib/feedback-shared";
import { getCurrentUser } from "@/lib/session";

export type FeedbackState = {
  ok: boolean;
  errors: Extract<FeedbackParse, { ok: false }>["errors"];
  message?: string;
} | null;

/** The client IP as the host saw it (Vercel sets both headers), keyed so it can't be reversed. */
async function ipHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHmac("sha256", env().BETTER_AUTH_SECRET).update(`feedback:${ip}`).digest("hex");
}

/** Stores one feedback message, from anyone, within the limits in lib/feedback-shared.ts. */
export async function sendFeedback(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  // A field people never see: bots that fill every input get a fake success and nothing is saved.
  const trap = formData.get("website");
  if (typeof trap === "string" && trap !== "") return { ok: true, errors: {} };

  const parsed = parseFeedback({
    kind: formData.get("kind"),
    message: formData.get("message"),
    contact: formData.get("contact"),
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const [user, hash] = await Promise.all([getCurrentUser(), ipHash()]);
  // Signed in, the account and the IP share one budget, so new accounts don't reset it.
  const sender = user
    ? or(eq(feedback.userId, user.id), eq(feedback.ipHash, hash))
    : eq(feedback.ipHash, hash);

  try {
    const [counts] = await db
      .select({
        senderLastHour: sql<number>`count(*) filter (where ${sender} and ${feedback.createdAt} > now() - interval '1 hour')`,
        senderLastDay: sql<number>`count(*) filter (where ${sender})`,
        everyoneLastDay: sql<number>`count(*)`,
      })
      .from(feedback)
      .where(gt(feedback.createdAt, sql`now() - interval '1 day'`));
    const limited = feedbackLimitError({
      senderLastHour: Number(counts?.senderLastHour ?? 0),
      senderLastDay: Number(counts?.senderLastDay ?? 0),
      everyoneLastDay: Number(counts?.everyoneLastDay ?? 0),
    });
    if (limited) return { ok: false, errors: {}, message: limited };

    await db.insert(feedback).values({ ...parsed.value, userId: user?.id ?? null, ipHash: hash });
  } catch {
    return { ok: false, errors: {}, message: "Could not send your feedback. Please try again." };
  }
  return { ok: true, errors: {} };
}
