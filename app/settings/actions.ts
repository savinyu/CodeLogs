"use server";

import { eq, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDeleteConfirmed } from "@/lib/account-export-shared";
import { auth } from "@/lib/auth";
import { userDataChanged } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { friendships, socialLinks, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  parseSocialLink,
  SOCIAL_KINDS,
  type SocialKind,
  type SocialLinks,
} from "@/lib/social-links-shared";

export type SettingResult = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "Could not save that. Try again.";

/** Opt in to (or out of) the public /u/<username> page. */
export async function setPublicProfile(enabled: unknown): Promise<SettingResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to change your profile." };
  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return { ok: false, error: "Invalid setting." };
  if (!user.username) return { ok: false, error: "Your account has no username for a public URL." };

  try {
    // Going private also leaves the global board, so a later opt-in doesn't silently relist.
    await db
      .update(users)
      .set(parsed.data ? { publicProfile: true } : { publicProfile: false, globalBoard: false })
      .where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
  userDataChanged(user.id);
  return { ok: true };
}

/** Opt in to (or out of) the global weekly board. Turning it on needs a public profile. */
export async function setGlobalBoard(enabled: unknown): Promise<SettingResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to change your profile." };
  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return { ok: false, error: "Invalid setting." };
  try {
    if (parsed.data) {
      const [row] = await db
        .select({ publicProfile: users.publicProfile })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (!row?.publicProfile) {
        return { ok: false, error: "Make your profile public to join the global leaderboard." };
      }
    }
    await db.update(users).set({ globalBoard: parsed.data }).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
  userDataChanged(user.id);
  return { ok: true };
}

/** Problems per day for Today's goal ring (1 to 20). */
export async function setDailyGoal(input: unknown): Promise<SettingResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to change your goal." };
  const parsed = z.coerce.number().int().min(1).max(20).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Use a whole number from 1 to 20." };

  try {
    await db.update(users).set({ dailyGoal: parsed.data }).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Could not save your goal. Please try again." };
  }
  userDataChanged(user.id);
  return { ok: true };
}

export type SocialLinksState = {
  ok: boolean;
  /** What the inputs show next: the saved values on success, the raw input otherwise. */
  values: SocialLinks;
  errors: Partial<Record<SocialKind, string>>;
  message?: string;
} | null;

/** Replaces the user's social links with the submitted form. An empty field removes that link. */
export async function saveSocialLinks(
  _prev: SocialLinksState,
  formData: FormData,
): Promise<SocialLinksState> {
  const values: SocialLinks = {};
  const errors: Partial<Record<SocialKind, string>> = {};
  const saved: SocialLinks = {};
  for (const kind of SOCIAL_KINDS) {
    const raw = formData.get(kind);
    values[kind] = typeof raw === "string" ? raw : "";
    const result = parseSocialLink(kind, raw);
    if (!result.ok) errors[kind] = result.error;
    else if (result.value) saved[kind] = result.value;
  }
  const failed = (message?: string) => ({ ok: false, values, errors, message });

  const user = await getCurrentUser();
  if (!user) return failed("You are signed out. Sign in again to continue.");
  if (Object.keys(errors).length > 0) return failed();

  const rows = SOCIAL_KINDS.flatMap((kind) => {
    const value = saved[kind];
    return value ? [{ userId: user.id, kind, value }] : [];
  });
  const clear = db.delete(socialLinks).where(eq(socialLinks.userId, user.id));
  try {
    await (rows.length > 0 ? db.batch([clear, db.insert(socialLinks).values(rows)]) : clear);
  } catch {
    return failed("Could not save your links. Please try again.");
  }

  refresh();
  return { ok: true, values: saved, errors: {}, message: "Saved." };
}

export type DeleteAccountState = { ok: false; error: string } | null;

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are signed out. Sign in again to continue." };

  const confirmation = formData.get("confirmation");
  if (typeof confirmation !== "string" || !isDeleteConfirmed(user.username, confirmation)) {
    return { ok: false, error: "The confirmation text does not match." };
  }

  let friendIds: string[];
  try {
    const rows = await db
      .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
      .from(friendships)
      .where(or(eq(friendships.requesterId, user.id), eq(friendships.addresseeId, user.id)));
    friendIds = [
      ...new Set(
        rows.flatMap((r) => [r.requesterId, r.addresseeId]).filter((id) => id !== user.id),
      ),
    ];
    // Sessions, OAuth links, platform accounts and everything under them cascade from users.id.
    await db.delete(users).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Could not delete your account. Please try again." };
  }

  // Their friends' cached lists and boards, and the global board, still show the deleted user.
  userDataChanged(user.id, ...friendIds);

  try {
    // Clears the session cookies; the session rows are already gone, which signOut tolerates.
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Nothing left to sign out of.
  }

  redirect("/");
}
