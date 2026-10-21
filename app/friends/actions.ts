"use server";

import { and, count, eq } from "drizzle-orm";
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
/** Buttons on rendered lists and profiles act by user id: a username can change (Settings). */
const userIdSchema = z.string().min(1).max(100);

type Person = { id: string; name: string; username: string | null };

const personColumns = { id: users.id, name: users.name, username: users.username };

/** By a normalized (lowercase) username: stored ones are lowercase, so this hits the unique index. */
async function findUser(username: string): Promise<Person | null> {
  const [row] = await db
    .select(personColumns)
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row ?? null;
}

async function findUserById(id: string): Promise<Person | null> {
  const [row] = await db.select(personColumns).from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/** "@name" for messages, or the display name for someone without a username. */
function handleOf(person: Person): string {
  return person.username ? `@${person.username}` : person.name;
}

/** The failure for a pair that already has a friendship row, or null when there is none. */
async function findExisting(userId: string, other: Person): Promise<FriendActionResult | null> {
  const [existing] = await db
    .select({ requesterId: friendships.requesterId, status: friendships.status })
    .from(friendships)
    .where(pairWhere(userId, other.id))
    .limit(1);
  if (!existing) return null;
  const who = handleOf(other);
  if (existing.status === "accepted") {
    return { ok: false, error: `${who} is already your friend.`, code: "friends" };
  }
  return existing.requesterId === userId
    ? { ok: false, error: `Your request to ${who} is still pending.`, code: "pending_out" }
    : {
        ok: false,
        error: `${who} already sent you a request. Accept it below.`,
        code: "pending_in",
      };
}

/** Sends a request from `userId` to `other`, after the limits and an existing-row check. */
async function requestFriendship(userId: string, other: Person): Promise<FriendActionResult> {
  try {
    const existing = await findExisting(userId, other);
    if (existing) return existing;
    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(friendships)
      .where(and(eq(friendships.requesterId, userId), eq(friendships.status, "pending")));
    if (n >= MAX_OUTGOING) {
      return {
        ok: false,
        error: `You have ${MAX_OUTGOING} requests waiting. Cancel one before sending another.`,
      };
    }
    await db
      .insert(friendships)
      .values({ requesterId: userId, addresseeId: other.id, status: "pending" });
    userDataChanged(userId, other.id);
    return { ok: true, message: `Request sent to ${handleOf(other)}.` };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // A concurrent request between the two of you won the race: report what is there now.
      try {
        const existing = await findExisting(userId, other);
        if (existing) return existing;
      } catch {
        // fall through to the generic error
      }
    }
    return { ok: false, error: FAILED };
  }
}

/** Send a request to the user with this username (the Add friend form). */
export async function sendFriendRequest(username: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = usernameSchema.safeParse(username);
  const target = parsed.success ? normalizeUsername(parsed.data) : "";
  if (!isValidUsername(target)) {
    return { ok: false, error: "Enter a CodeLogs username, like anvi_k." };
  }
  let other: Person | null;
  try {
    other = await findUser(target);
  } catch {
    return { ok: false, error: FAILED };
  }
  if (!other) return { ok: false, error: "No CodeLogs user with that username." };
  // By id: the session's username can lag a username change by a few minutes.
  if (other.id === user.id) return { ok: false, error: "That is your own username." };
  return requestFriendship(user.id, other);
}

/** Send a request to this user (the Add friend button on a public profile). */
export async function sendFriendRequestTo(userId: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  if (parsed.data === user.id) return { ok: false, error: "You can't add yourself." };
  let other: Person | null;
  try {
    other = await findUserById(parsed.data);
  } catch {
    return { ok: false, error: FAILED };
  }
  if (!other) return { ok: false, error: "That account no longer exists." };
  return requestFriendship(user.id, other);
}

const respondSchema = z.object({ userId: userIdSchema, accept: z.boolean() });

/** Accept a request someone sent you, or decline it (which deletes it, silently). */
export async function respondToRequest(input: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const otherId = parsed.data.userId;
  const gone = { ok: false as const, error: "That request is no longer there." };
  const match = and(
    eq(friendships.requesterId, otherId),
    eq(friendships.addresseeId, user.id),
    eq(friendships.status, "pending"),
  );

  try {
    if (parsed.data.accept) {
      // One round trip: the accept, and the name for the message.
      const [updated, [other]] = await db.batch([
        db
          .update(friendships)
          .set({ status: "accepted", acceptedAt: new Date() })
          .where(match)
          .returning({ id: friendships.requesterId }),
        db.select({ name: users.name }).from(users).where(eq(users.id, otherId)).limit(1),
      ]);
      if (updated.length === 0) return gone;
      userDataChanged(user.id, otherId);
      return {
        ok: true,
        message: `${other?.name ?? "Your new friend"} is now your friend and joins your board.`,
      };
    }
    const deleted = await db
      .delete(friendships)
      .where(match)
      .returning({ id: friendships.requesterId });
    if (deleted.length === 0) return gone;
    userDataChanged(user.id, otherId);
    return { ok: true, message: "Request declined. They are not told." };
  } catch {
    return { ok: false, error: FAILED };
  }
}

/** Withdraw a request you sent. */
export async function cancelRequest(userId: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const deleted = await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.requesterId, user.id),
          eq(friendships.addresseeId, parsed.data),
          eq(friendships.status, "pending"),
        ),
      )
      .returning({ id: friendships.addresseeId });
    // Already gone (accepted, declined or cancelled elsewhere): refresh the list to show that.
    userDataChanged(user.id, ...(deleted.length > 0 ? [parsed.data] : []));
    return deleted.length > 0
      ? { ok: true, message: "Request cancelled." }
      : { ok: false, error: "That request is no longer there." };
  } catch {
    return { ok: false, error: FAILED };
  }
}

/** End a friendship. The other person isn't told. */
export async function removeFriend(userId: unknown): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const deleted = await db
      .delete(friendships)
      .where(and(pairWhere(user.id, parsed.data), eq(friendships.status, "accepted")))
      .returning({ id: friendships.requesterId });
    userDataChanged(user.id, ...(deleted.length > 0 ? [parsed.data] : []));
    return deleted.length > 0
      ? { ok: true, message: "Friend removed." }
      : { ok: false, error: "You are no longer friends." };
  } catch {
    return { ok: false, error: FAILED };
  }
}
