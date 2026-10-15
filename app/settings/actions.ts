"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDeleteConfirmed } from "@/lib/account-export-shared";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { socialLinks, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  parseSocialLink,
  SOCIAL_KINDS,
  type SocialKind,
  type SocialLinks,
} from "@/lib/social-links-shared";

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

  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // The session rows are deleted with the user anyway.
  }

  try {
    // Sessions, OAuth links, platform accounts and everything under them cascade from users.id.
    await db.delete(users).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Could not delete your account. Please try again." };
  }

  redirect("/");
}
