import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";
import { assignEmailUsername } from "@/lib/assign-username";
import { googleConfig } from "@/lib/auth-providers";
import { assignGithubUsername } from "@/lib/github-username";

const google = googleConfig();

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
    ...(google && { google: { ...google, prompt: "select_account" as const } }),
  },
  // A second provider with the same verified email signs in to the same user (Better Auth's
  // implicit linking, on by default). Google and GitHub both report whether the email is verified.
  user: {
    additionalFields: {
      // Not user-editable. Set by the account hook below: the GitHub login, or one made from the
      // Google email. githubLogin is the linked GitHub login, if any.
      username: { type: "string", required: false, input: false },
      githubLogin: { type: "string", required: false, input: false },
      publicProfile: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          try {
            if (account.providerId === "github") {
              await assignGithubUsername(
                db,
                account.userId,
                account.accountId,
                account.accessToken,
              );
            } else if (account.providerId === "google") {
              await assignEmailUsername(db, account.userId);
            }
          } catch (err) {
            // Never fail a sign-in over this; the user just has no public URL yet.
            console.error(`Could not set the username (${account.providerId})`, err);
          }
        },
      },
    },
  },
  // Must stay last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
