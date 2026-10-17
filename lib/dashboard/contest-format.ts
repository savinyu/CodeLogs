import type { ContestPlatform } from "./types";

/**
 * A short label for a contest's format, read from its name: "Div. 2", "Educational · Div. 2",
 * "Div. 1 + 2", "Global" on Codeforces; "Weekly" or "Biweekly" on LeetCode. Null when the name
 * doesn't say (Kotlin Heroes, April Fools, …).
 */
export function contestFormat(platform: ContestPlatform, name: string): string | null {
  if (platform === "leetcode") {
    if (/^biweekly\b/i.test(name)) return "Biweekly";
    if (/^weekly\b/i.test(name)) return "Weekly";
    return null;
  }
  const kind = /\beducational\b/i.test(name)
    ? "Educational"
    : /\bglobal round\b/i.test(name)
      ? "Global"
      : null;
  const div = /div\.?\s*1\s*\+\s*div\.?\s*2/i.test(name)
    ? "Div. 1 + 2"
    : (/div\.?\s*([1-4])/i.exec(name)?.[1] ?? null);
  const divLabel = div === null ? null : div.startsWith("Div") ? div : `Div. ${div}`;
  return [kind, divLabel].filter(Boolean).join(" · ") || null;
}

/**
 * The name without its trailing "(Div. 2, …)" note, which `contestFormat` already covers:
 * "Codeforces Round 848 (Div. 2)" → "Codeforces Round 848".
 */
export function contestTitle(name: string): string {
  return name.replace(/\s*\([^()]*\)\s*$/, "") || name;
}
