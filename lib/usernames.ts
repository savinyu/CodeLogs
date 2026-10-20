// Pure helpers that turn a name or email into valid public usernames (see isValidUsername).

const MAX_LENGTH = 39;

function trimPunctuation(s: string): string {
  return s.replace(/^[.\-_]+|[.\-_]+$/g, "");
}

/** Lowercased, accents stripped, junk runs → "-", trimmed, ≤ 39 chars. Null if under 2 chars. */
export function usernameBase(input: string): string | null {
  const cleaned = input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-");
  const base = trimPunctuation(trimPunctuation(cleaned).slice(0, MAX_LENGTH));
  return base.length >= 2 ? base : null;
}

/** Base from a full email address: the local part without any +tag. */
export function emailUsernameBase(email: string): string | null {
  const at = email.lastIndexOf("@");
  const local = at === -1 ? email : email.slice(0, at);
  return usernameBase(local.split("+")[0] ?? "");
}

/** `[base, base-2, base-3, …]`, each ≤ 39 chars; the base is shortened to fit the suffix. */
export function usernameCandidates(base: string, count = 20): string[] {
  const out = [base];
  for (let n = 2; out.length < count; n++) {
    const suffix = `-${n}`;
    const head = trimPunctuation(base.slice(0, MAX_LENGTH - suffix.length));
    out.push(`${head}${suffix}`);
  }
  return out;
}

const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** `base-xxxxx` with a random 5-char [a-z0-9] suffix, ≤ 39 chars; for when every numbered candidate is taken. */
export function randomUsernameCandidate(
  base: string,
  random: (max: number) => number = (max) => crypto.getRandomValues(new Uint32Array(1))[0]! % max,
): string {
  let suffix = "-";
  for (let i = 0; i < 5; i++) suffix += SUFFIX_ALPHABET[random(SUFFIX_ALPHABET.length)];
  const head = trimPunctuation(base.slice(0, MAX_LENGTH - suffix.length));
  return `${head}${suffix}`;
}
