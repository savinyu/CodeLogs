"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";

export type PublicProfileState = { ok: true } | { ok: false; error: string };

/** Opt in to (or out of) the public /u/<username> page. */
export async function setPublicProfile(enabled: unknown): Promise<PublicProfileState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to change your profile." };
  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return { ok: false, error: "Invalid setting." };
  if (!user.username) return { ok: false, error: "Your account has no username for a public URL." };

  await db.update(users).set({ publicProfile: parsed.data }).where(eq(users.id, user.id));
  refresh();
  return { ok: true };
}
