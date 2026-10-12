// Offline handle checks: accepts a pasted profile URL or "@handle", then checks the format.
// lib/adapters/validate.ts runs this first, then asks the platform whether the account exists.
// Keep this file free of server-only and "@/" runtime imports so tests can load it directly.

import { PLATFORM_META } from "../platforms";
import type { PlatformId, ValidateResult } from "./types";

const PROFILE_URL_PATTERNS: Record<PlatformId, RegExp[]> = {
  codeforces: [/^(?:https?:\/\/)?(?:www\.)?codeforces\.com\/profile\/([^/?#\s]+)/i],
  atcoder: [/^(?:https?:\/\/)?(?:www\.)?atcoder\.jp\/users\/([^/?#\s]+)/i],
  leetcode: [
    /^(?:https?:\/\/)?(?:www\.)?leetcode\.com\/u\/([^/?#\s]+)/i,
    /^(?:https?:\/\/)?(?:www\.)?leetcode\.com\/(?!u\/)([^/?#\s]+)/i,
  ],
};

function extractHandle(platform: PlatformId, raw: string): string {
  let value = raw.trim();
  for (const pattern of PROFILE_URL_PATTERNS[platform]) {
    const captured = pattern.exec(value)?.[1];
    if (captured !== undefined) {
      try {
        value = decodeURIComponent(captured);
      } catch {
        value = captured;
      }
      break;
    }
  }
  return value.replace(/^@/, "").trim();
}

export async function checkHandleFormat(
  platform: PlatformId,
  rawHandle: string,
): Promise<ValidateResult> {
  const meta = PLATFORM_META[platform];
  const handle = extractHandle(platform, rawHandle);

  if (handle === "") {
    return { result: "invalid", message: `Enter your ${meta.name} handle.` };
  }
  if (!meta.handlePattern.test(handle)) {
    return {
      result: "invalid",
      message: `That doesn't look like a ${meta.name} handle. ${describeRules(platform)}`,
    };
  }
  return { result: "valid", canonicalHandle: handle };
}

function describeRules(platform: PlatformId): string {
  switch (platform) {
    case "codeforces":
      return "Use 3-24 characters: letters, digits, underscores, dots or hyphens.";
    case "atcoder":
      return "Use 3-16 characters: letters, digits or underscores.";
    case "leetcode":
      return "Use 1-30 characters: letters, digits, underscores or hyphens.";
  }
}
