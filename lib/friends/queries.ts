// Friends and weekly board reads. Server-only; the pure ranking lives in points.ts.

import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { PlatformId } from "@/lib/adapters/types";
import { db } from "@/lib/db/client";
import { friendships, platformAccounts, problems, solves, users } from "@/lib/db/schema";
import { rankBoard, type BoardEntry, type RankedEntry } from "./points";

export type FriendPerson = {
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
};

export type FriendsState = {
  friends: FriendPerson[];
  /** People who asked you. */
  incoming: FriendPerson[];
  /** People you asked. */
  outgoing: FriendPerson[];
};

export type Friendship = "none" | "friends" | "outgoing" | "incoming";

const personColumns = {
  userId: users.id,
  name: users.name,
  username: users.username,
  image: users.image,
};

export async function getFriendsState(userId: string): Promise<FriendsState> {
  // One row per pair you're in, joined to the other person.
  const rows = await db
    .select({
      ...personColumns,
      status: friendships.status,
      mine: sql<boolean>`${friendships.requesterId} = ${userId}`,
    })
    .from(friendships)
    .innerJoin(
      users,
      sql`${users.id} = CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END`,
    )
    .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
  const person = ({ userId, name, username, image }: (typeof rows)[number]): FriendPerson => ({
    userId,
    name,
    username,
    image,
  });
  const pending = rows.filter((r) => r.status === "pending");
  return {
    friends: rows.filter((r) => r.status === "accepted").map(person),
    incoming: pending.filter((r) => !r.mine).map(person),
    outgoing: pending.filter((r) => r.mine).map(person),
  };
}

/** The friendships row for a pair of users, whichever of them asked. */
export function pairWhere(a: string, b: string) {
  return or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );
}

/** How `userId` stands with `otherUserId`, for the public profile's button. */
export async function getFriendship(userId: string, otherUserId: string): Promise<Friendship> {
  if (userId === otherUserId) return "none";
  const [row] = await db
    .select({ requesterId: friendships.requesterId, status: friendships.status })
    .from(friendships)
    .where(pairWhere(userId, otherUserId))
    .limit(1);
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requesterId === userId ? "outgoing" : "incoming";
}

type SolveAggregate = {
  user_id: string;
  platform: PlatformId;
  solves: number;
  points: number;
  days: string[];
};

/**
 * This week's board for the given users. Only verified handles count, and a solve is in the
 * week by first_solved_at. Users without solves still appear, with zeros.
 */
export async function getBoardEntries(
  userIds: string[],
  since: Date,
): Promise<(BoardEntry & { isPublic: boolean })[]> {
  if (userIds.length === 0) return [];
  const [people, aggregates] = await Promise.all([
    db
      .select({ ...personColumns, isPublic: users.publicProfile })
      .from(users)
      .where(inArray(users.id, userIds)),
    db.execute<SolveAggregate>(sql`
      SELECT s.user_id, pa.platform,
        count(*)::int AS solves,
        sum(coalesce(p.difficulty_norm, 1))::int AS points,
        array_agg(DISTINCT to_char(s.first_solved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')) AS days
      FROM ${solves} s
      JOIN ${problems} p ON p.id = s.problem_id
      JOIN ${platformAccounts} pa ON pa.id = s.account_id AND pa.verified = true
      WHERE s.user_id IN (${sql.join(
        userIds.map((id) => sql`${id}`),
        sql`, `,
      )})
        AND s.first_solved_at >= ${since.toISOString()}
      GROUP BY s.user_id, pa.platform`),
  ]);

  const byUser = new Map<string, SolveAggregate[]>();
  for (const row of aggregates.rows) {
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  }
  return people.map((person) => {
    const rows = byUser.get(person.userId) ?? [];
    const platforms: Partial<Record<PlatformId, number>> = {};
    const days = new Set<string>();
    let points = 0;
    let count = 0;
    for (const row of rows) {
      platforms[row.platform] = row.solves;
      points += row.points;
      count += row.solves;
      for (const day of row.days) days.add(day);
    }
    return { ...person, points, solves: count, activeDays: days.size, platforms };
  });
}

export type GlobalBoard = {
  top: (RankedEntry & { isPublic: boolean })[];
  me: (RankedEntry & { isPublic: boolean }) | null;
  /** Public profiles on the board. */
  listed: number;
  isListed: boolean;
};

/** The opt-in global board: users with a public profile and the switch on. */
export async function getGlobalBoard(userId: string, since: Date): Promise<GlobalBoard> {
  const listedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.publicProfile, true), eq(users.globalBoard, true)));
  const ids = listedUsers.map((u) => u.id);
  const entries = await getBoardEntries(ids, since);
  const ranked = rankBoard(entries);
  const me = ranked.find((entry) => entry.userId === userId) ?? null;
  return {
    top: ranked.slice(0, 10),
    me: me && me.rank > 10 ? me : null,
    listed: ranked.length,
    isListed: me !== null,
  };
}
