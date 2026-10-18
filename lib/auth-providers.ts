import "server-only";
import { env } from "@/lib/env";

/** The sign-in options, in the order the buttons show them. */
export type SocialProvider = "google" | "github";

/** Google's client credentials, or null when Google sign-in isn't configured. */
export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = env();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** The providers a visitor can sign in with. GitHub is always configured. */
export function signInProviders(): SocialProvider[] {
  return googleConfig() ? ["google", "github"] : ["github"];
}
