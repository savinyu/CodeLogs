// Pure helpers for the handle verification flow (no DB, safe for client code and tests).

import type { SyncedPlatformId } from "@/lib/adapters/types";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const TOKEN_PREFIX = "logn-";
const TOKEN_LENGTH = 6;

function randomChar(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return ALPHABET.charAt((buf[0] ?? 0) % ALPHABET.length);
}

/** `random` returns one alphabet character per call; injectable for tests. */
export function makeVerifyToken(random: () => string = randomChar): string {
  let suffix = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) suffix += random();
  return TOKEN_PREFIX + suffix;
}

/** Case-insensitive substring match, so the code can sit next to the user's existing text. */
export function fieldContainsToken(field: string | null, token: string): boolean {
  if (!field || !token) return false;
  return field.toLowerCase().includes(token.toLowerCase());
}

/** The bio-code check, for server-synced platforms. Extension platforms verify by login match. */
export const VERIFY_FIELD: Record<
  SyncedPlatformId,
  { label: string; settingsUrl: string; hint: string }
> = {
  codeforces: {
    label: "Organization",
    settingsUrl: "https://codeforces.com/settings/social",
    hint: "Paste it into the Organization field on your Codeforces social settings.",
  },
  atcoder: {
    label: "Affiliation",
    settingsUrl: "https://atcoder.jp/settings",
    hint: "Paste it into the Affiliation field in your AtCoder settings.",
  },
  leetcode: {
    label: "Summary",
    settingsUrl: "https://leetcode.com/profile/",
    hint: "Paste it into the ReadMe field (Edit profile, then ReadMe) on your LeetCode profile.",
  },
};
