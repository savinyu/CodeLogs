import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";
import { assignGithubUsername } from "@/lib/github-username";

export const auth = betterAuth({
  secret: env().BETTER_AUTH_SECRET,
  baseURL: env().BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  // Pages read the session on every render. A signed cookie holding it for 5 minutes saves a
  // sessions + users lookup per request; a sign-out or revoke takes effect within that window.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  socialProviders: {
    github: {
      clientId: env().GITHUB_CLIENT_ID,
      clientSecret: env().GITHUB_CLIENT_SECRET,
    },
  },
  user: {
    additionalFields: {
      // Not user-editable. Set from the GitHub login by the account hook below.
      username: { type: "string", required: false, input: false },
      publicProfile: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          if (account.providerId !== "github") return;
          try {
            await assignGithubUsername(db, account.userId, account.accountId, account.accessToken);
          } catch (err) {
            // Never fail a sign-in over this; the user just has no public URL yet.
            console.error("Could not set the GitHub username", err);
          }
        },
      },
    },
  },
  // Must stay last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
