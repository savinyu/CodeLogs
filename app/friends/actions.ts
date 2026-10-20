"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { userDataChanged } from "@/lib/cache";
import { isUniqueViolation } from "@/lib/assign-username";
import { db } from "@/lib/db/client";
import { friendships, users } from "@/lib/db/schema";
import { pairWhere } from "@/lib/friends/queries";
import { isValidUsername, normalizeUsername } from "@/lib/friends/username";
import { getCurrentUser } from "@/lib/session";

/** Machine-readable reason for a failed request, so the UI can show the real relationship. */
export type FriendFailureCode = "pending_out" | "pending_in" | "friends";

export type FriendActionResult =
  { ok: true; message: string } | { ok: false; error: string; code?: FriendFailureCode };

/** Pending requests one person may have out at a time. */
const MAX_OUTGOING = 20;
const SIGNED_OUT = "You are signed out. Sign in again to continue.";
const FAILED = "Something went wrong. Please try again.";

const usernameSchema = z.string().max(80);

async function findUser(username: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(sql`lower(${users.username}) = ${username}`)
    .limit(1);
  return row ?? null;
}

/** The failure for a pair that already has a friendship row, or null when there is none. */
async function findExisting(
  userId: string,
  otherId: string,
  target: string,
): Promise<FriendActionResult | null> {
  const [existing] = await db
    .select({ requesterId: friendships.requesterId, status: friendships.status })
    .from(friendships)
    .where(pairWhere(userId, otherId))
    .limit(1);
  if (!existing) return null;
  if (existing.status === "accepted") {
    return { ok: false, error: `@${target} is already your friend.`, code: "friends" };
  }
  return existing.requesterId === userId
    ? { ok: false, error: `Your request to @${target} is still pending.`, code: "pending_out" }
    : {
        ok: false,
        error: `@${target} already sent you a request. Accept it below.`,
        code: "pending_in",
      };
}

export async function sendFriendRequest(username: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = usernameSchema.safeParse(username);
  const target = parsed.success ? normalizeUsername(parsed.data) : "";
  if (!isValidUsername(target)) {
    return { ok: false, error: "Enter a CodeLogs username, like anvi_k." };
  }
  if (target === user.username?.toLowerCase()) {
    return { ok: false, error: "That is your own username." };
  }

  try {
    const other = await findUser(target);
    if (!other || other.id === user.id) {
      return { ok: false, error: "No CodeLogs user with that username." };
    }
    const existing = await findExisting(user.id, other.id, target);
    if (existing) return existing;
    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(friendships)
      .where(and(eq(friendships.requesterId, user.id), eq(friendships.status, "pending")));
    if (n >= MAX_OUTGOING) {
      return {
        ok: false,
        error: `You have ${MAX_OUTGOING} requests waiting. Cancel one before sending another.`,
      };
    }
    await db
      .insert(friendships)
      .values({ requesterId: user.id, addresseeId: other.id, status: "pending" });
    userDataChanged(user.id, other.id);
    return { ok: true, message: `Request sent to @${target}.` };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // A concurrent request between the two of you won the race: report what is there now.
      try {
        const other = await findUser(target);
        const existing = other ? await findExisting(user.id, other.id, target) : null;
        if (existing) return existing;
      } catch {
        // fall through to the generic error
      }
    }
    return { ok: false, error: FAILED };
  }
}

const respondSchema = z.object({ username: usernameSchema, accept: z.boolean() });

/** Accept a request someone sent you, or decline it (which deletes it, silently). */
export async function respondToRequest(input: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const target = normalizeUsername(parsed.data.username);

  try {
    const other = await findUser(target);
    if (!other) return { ok: false, error: "That request is no longer there." };
    const match = and(
      eq(friendships.requesterId, other.id),
      eq(friendships.addresseeId, user.id),
      eq(friendships.status, "pending"),
    );
    if (parsed.data.accept) {
      const updated = await db
        .update(friendships)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(match)
        .returning({ id: friendships.requesterId });
      if (updated.length === 0) return { ok: false, error: "That request is no longer there." };
      userDataChanged(user.id, other.id);
      return { ok: true, message: `${other.name} is now your friend and joins your board.` };
    }
    await db.delete(friendships).where(match);
    userDataChanged(user.id, other.id);
    return { ok: true, message: "Request declined. They are not told." };
  } catch {
    return { ok: false, error: FAILED };
  }
}

/** Withdraw a request you sent. */
export async function cancelRequest(username: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const other = await findUser(normalizeUsername(parsed.data));
    if (other) {
      await db
        .delete(friendships)
        .where(
          and(
            eq(friendships.requesterId, user.id),
            eq(friendships.addresseeId, other.id),
            eq(friendships.status, "pending"),
          ),
        );
    }
    userDataChanged(user.id, ...(other ? [other.id] : []));
    return { ok: true, message: "Request cancelled." };
  } catch {
    return { ok: false, error: FAILED };
  }
}

/** End a friendship. The other person isn't told. */
export async function removeFriend(username: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const other = await findUser(normalizeUsername(parsed.data));
    if (other) {
      await db
        .delete(friendships)
        .where(and(pairWhere(user.id, other.id), eq(friendships.status, "accepted")));
    }
    userDataChanged(user.id, ...(other ? [other.id] : []));
    return { ok: true, message: "Friend removed." };
  } catch {
    return { ok: false, error: FAILED };
  }
}
