"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { sheetFollows, sheetTicks } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { SHEETS } from "@/lib/sheets";

export type SheetActionResult = { ok: true } | { ok: false; error: string };

const SHEET_IDS = SHEETS.map((s) => s.id) as [string, ...string[]];
const SHEET_SLUGS: ReadonlySet<string> = new Set(
  SHEETS.flatMap((s) => s.sections.flatMap((sec) => sec.problems.map((p) => p.slug))),
);

const followInput = z.object({ sheetId: z.enum(SHEET_IDS), following: z.boolean() });
const tickInput = z.object({ slug: z.string().min(1).max(200), ticked: z.boolean() });

/** Follow or unfollow a sheet. */
export async function setSheetFollow(input: unknown): Promise<SheetActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to follow sheets." };
  const parsed = followInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid sheet." };
  const { sheetId, following } = parsed.data;
  await db
    .insert(sheetFollows)
    .values({ userId: user.id, sheetId, following })
    .onConflictDoUpdate({
      target: [sheetFollows.userId, sheetFollows.sheetId],
      set: { following, updatedAt: new Date() },
    });
  refresh();
  return { ok: true };
}

/** Mark a sheet problem as solved by hand, or undo it. Ticks count inside sheets only. */
export async function setSheetTick(input: unknown): Promise<SheetActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to tick problems." };
  const parsed = tickInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid problem." };
  const { slug, ticked } = parsed.data;
  if (!SHEET_SLUGS.has(slug)) return { ok: false, error: "That problem is not on a sheet." };
  if (ticked) {
    await db.insert(sheetTicks).values({ userId: user.id, slug }).onConflictDoNothing();
  } else {
    await db
      .delete(sheetTicks)
      .where(and(eq(sheetTicks.userId, user.id), eq(sheetTicks.slug, slug)));
  }
  refresh();
  return { ok: true };
}
