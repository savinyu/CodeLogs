// Sets users.username from the GitHub login, for /u/<username>.
// Better Auth drops `input: false` fields returned by mapProfileToUser when it creates an OAuth
// user, and making the field writable would let users pick any name through /update-user. So the
// login is looked up here, after the GitHub account row exists. No server-only import, so
// scripts can run it too.

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

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
      "User-Agent": "CodeLogs",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const parsed = githubUserSchema.safeParse(await res.json());
  return parsed.success ? parsed.data.login.toLowerCase() : null;
}

/** Fills in a missing username; never overwrites one. Returns the username it set, if any. */
export async function assignGithubUsername(
  db: DB,
  userId: string,
  accountId: string,
  accessToken?: string | null,
): Promise<string | null> {
  const login = await fetchGithubLogin(accountId, accessToken);
  if (!login) return null;
  const updated = await db
    .update(users)
    .set({ username: login })
    .where(and(eq(users.id, userId), isNull(users.username)))
    .returning({ username: users.username });
  return updated[0]?.username ?? null;
}
