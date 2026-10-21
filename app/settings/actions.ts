"use server";

import { and, eq, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDeleteConfirmed } from "@/lib/account-export-shared";
import { isUniqueViolation } from "@/lib/assign-username";
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
import { parseNewUsername } from "@/lib/username-change";

export type SettingResult = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "Could not save that. Try again.";
const SIGNED_OUT = "You are signed out. Sign in again to continue.";

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

/** Every friendships row the user is in (friends and pending requests either way). */
function friendPairs(userId: string) {
  return db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
}

/** The other person in each row: whose cached lists and boards show this user. */
function otherIds(pairs: { requesterId: string; addresseeId: string }[], userId: string) {
  return [...new Set(pairs.map((p) => (p.requesterId === userId ? p.addresseeId : p.requesterId)))];
}

/** Another user holds `username` as their username or as their (verified) GitHub login. */
function heldByOther(username: string, userId: string) {
  return and(
    or(eq(users.username, username), eq(users.githubLogin, username)),
    ne(users.id, userId),
  );
}

export type UsernameCheckResult = { ok: true; username: string } | { ok: false; error: string };

const USERNAME_TAKEN = "That username is taken.";

/**
 * Live check for the username field: valid and free. changeUsername checks again on save. A DB
 * failure throws, so the form doesn't remember it as the name's answer.
 */
export async function checkUsername(input: unknown): Promise<UsernameCheckResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = parseNewUsername(input, user.username);
  if (!parsed.ok) return parsed;
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(heldByOther(parsed.username, user.id))
    .limit(1);
  return taken ? { ok: false, error: USERNAME_TAKEN } : parsed;
}

/**
 * Sets a username the user picked. Changing one is allowed once (usernameChangedAt marks it used);
 * picking one when the user has none is free.
 */
export async function changeUsername(input: unknown): Promise<UsernameCheckResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = parseNewUsername(input, user.username);
  if (!parsed.ok) return parsed;
  const { username } = parsed;

  const other = alias(users, "other");
  let friendIds: string[];
  try {
    // One round trip: the guarded update (the unique index catches a username race) and the
    // friend ids whose cached lists show the old name. db.batch runs both in one transaction.
    const [claimed, pairs] = await db.batch([
      db
        .update(users)
        // Picking a first username (signup couldn't make one) doesn't use up the change.
        .set({
          username,
          usernameChangedAt: sql`case when ${users.username} is null then null else now() end`,
        })
        .where(
          and(
            eq(users.id, user.id),
            isNull(users.usernameChangedAt),
            notExists(
              db
                .select({ id: other.id })
                .from(other)
                .where(and(eq(other.githubLogin, username), ne(other.id, user.id))),
            ),
          ),
        )
        .returning({ id: users.id }),
      friendPairs(user.id),
    ]);
    if (claimed.length === 0) {
      // Rare: already changed (another tab), or the name is someone's GitHub login.
      const [row] = await db
        .select({ usernameChangedAt: users.usernameChangedAt })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      return row?.usernameChangedAt
        ? { ok: false, error: "You have already changed your username." }
        : { ok: false, error: USERNAME_TAKEN };
    }
    friendIds = otherIds(pairs, user.id);
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: USERNAME_TAKEN };
    return { ok: false, error: SAVE_FAILED };
  }

  try {
    // Rewrites the session cookie cache from the DB, or this device shows the old name for up
    // to 5 minutes (lib/auth.ts). Other devices catch up when their cache expires.
    await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  } catch {
    // The cookie cache expires on its own.
  }
  // Friends' cached lists and boards show the name, and their buttons act on it.
  userDataChanged(user.id, ...friendIds);
  return { ok: true, username };
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
  const mismatch = { ok: false as const, error: "The confirmation text does not match." };
  if (typeof confirmation !== "string") return mismatch;

  let friendIds: string[];
  try {
    // The DB's username: the session's lags for a few minutes after a username change.
    const [[row], pairs] = await db.batch([
      db.select({ username: users.username }).from(users).where(eq(users.id, user.id)).limit(1),
      friendPairs(user.id),
    ]);
    if (!isDeleteConfirmed(row?.username ?? null, confirmation)) return mismatch;
    friendIds = otherIds(pairs, user.id);
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
