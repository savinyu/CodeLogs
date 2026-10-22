// Stores the GitHub login (users.githubLogin) and sets users.username from it, for /u/<username>.
// Better Auth drops `input: false` fields returned by mapProfileToUser when it creates an OAuth
// user, and making the field writable would let users pick any name through /update-user. So the
// login is looked up here, after the GitHub account row exists. No server-only import, so
// scripts can run it too.

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { claimUsername } from "@/lib/assign-username";
import type { DB } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { usernameBase } from "@/lib/usernames";

const githubUserSchema = z.object({ login: z.string().min(1) });

/** GitHub's numeric account id → login. Uses the OAuth token when we have one (higher rate limit). */
export async function fetchGithubLogin(
  accountId: string,
  accessToken?: string | null,
): Promise<string | null> {
  const url = accessToken
    ? "https://api.github.com/user"
    : `https://api.github.com/user/${encodeURIComponent(accountId)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "LogN",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const parsed = githubUserSchema.safeParse(await res.json());
  return parsed.success ? parsed.data.login.toLowerCase() : null;
}

/**
 * Records the GitHub login and fills in a missing username; never overwrites either. If the login
 * is already someone's username, the user gets `login-2` etc. Returns the username it set, if any.
 */
export async function assignGithubUsername(
  db: DB,
  userId: string,
  accountId: string,
  accessToken?: string | null,
): Promise<string | null> {
  const login = await fetchGithubLogin(accountId, accessToken);
  if (!login) return null;
  await db
    .update(users)
    .set({ githubLogin: login })
    .where(and(eq(users.id, userId), isNull(users.githubLogin)));
  const base = usernameBase(login);
  return base ? claimUsername(db, userId, base) : null;
}
