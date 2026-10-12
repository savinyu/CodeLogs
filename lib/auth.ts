import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

export const auth = betterAuth({
  secret: env().BETTER_AUTH_SECRET,
  baseURL: env().BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  socialProviders: {
    github: {
      clientId: env().GITHUB_CLIENT_ID,
      clientSecret: env().GITHUB_CLIENT_SECRET,
      // GitHub logins are unique, so they make a good default for /u/<username>.
      mapProfileToUser: (profile) => ({ username: profile.login.toLowerCase() }),
    },
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      publicProfile: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  // Must stay last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
