// Picks a free public username (users.username, for /u/<username>) for a user who has none.
// No server-only import, so scripts can run it too.

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import {
  emailUsernameBase,
  randomUsernameCandidate,
  usernameBase,
  usernameCandidates,
} from "@/lib/usernames";

/** Postgres unique violation; with neon-http + drizzle the pg error may sit on `cause`. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Sets the first free `base`, `base-2`, … (else `base-xxxxx`) as the username, only while the user has none.
 * Retries once if another signup grabs the name between the lookup and the update.
 */
export async function claimUsername(db: DB, userId: string, base: string): Promise<string | null> {
  const candidates = usernameCandidates(base);
  for (let attempt = 0; attempt < 2; attempt++) {
    const taken = await db
      .select({ username: users.username })
      .from(users)
      .where(inArray(users.username, candidates));
    const takenSet = new Set(taken.map((r) => r.username));
    let free = candidates.find((c) => !takenSet.has(c));
    if (!free) {
      // All numbered names are taken: fall back to a random suffix (a rare clash retries once).
      const random = randomUsernameCandidate(base);
      const [clash] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, random))
        .limit(1);
      if (clash) continue;
      free = random;
    }
    try {
      const updated = await db
        .update(users)
        .set({ username: free })
        .where(and(eq(users.id, userId), isNull(users.username)))
        .returning({ username: users.username });
      return updated[0]?.username ?? null;
    } catch (err) {
      if (!isUniqueViolation(err) || attempt === 1) throw err;
    }
  }
  return null;
}

/** Username from the email's local part (or the display name), for sign-in methods without a handle. */
export async function assignEmailUsername(db: DB, userId: string): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;
  const base = emailUsernameBase(user.email) ?? usernameBase(user.name ?? "");
  return base ? claimUsername(db, userId, base) : null;
}
