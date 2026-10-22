// Validates a username the user picks in Settings (pure, so the form and the action share it).
// Whether it's free is checked against the DB in app/settings/actions.ts.

import { isValidUsername, normalizeUsername } from "@/lib/friends/username";

/** Names that would read as the site or its staff. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "api",
  "codelogs",
  "logn",
  "help",
  "me",
  "mod",
  "moderator",
  "null",
  "official",
  "root",
  "settings",
  "staff",
  "support",
  "system",
  "team",
  "undefined",
]);

export type UsernameParse = { ok: true; username: string } | { ok: false; error: string };

/** Normalizes (trim, drop @, lowercase) and checks a new username against the current one. */
export function parseNewUsername(input: unknown, current: string | null): UsernameParse {
  if (typeof input !== "string") return { ok: false, error: "Enter a username." };
  const username = normalizeUsername(input);
  if (username.length < 2 || username.length > 39) {
    return { ok: false, error: "Use 2 to 39 characters." };
  }
  if (!isValidUsername(username)) {
    return { ok: false, error: "Use only letters, numbers, dots, dashes and underscores." };
  }
  if (!/^[a-z0-9].*[a-z0-9]$/.test(username)) {
    return { ok: false, error: "Start and end with a letter or number." };
  }
  if (RESERVED_USERNAMES.has(username)) return { ok: false, error: "That username is reserved." };
  if (username === current) return { ok: false, error: "That is already your username." };
  return { ok: true, username };
}
