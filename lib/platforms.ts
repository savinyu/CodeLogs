// Pure per-platform metadata. No server-only or alias imports, so tests and client code can use it.

import type { PlatformId } from "./adapters/types";

export interface PlatformMeta {
  id: PlatformId;
  name: string;
  profileUrl(handle: string): string;
  handleHint: string;
  handlePattern: RegExp;
  history: "full" | "recent_only";
  /** Short caveat shown on the platform's card. */
  note?: string;
}

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  codeforces: {
    id: "codeforces",
    name: "Codeforces",
    profileUrl: (handle) => `https://codeforces.com/profile/${encodeURIComponent(handle)}`,
    handleHint: "tourist",
    handlePattern: /^[A-Za-z0-9_.-]{3,24}$/,
    history: "full",
  },
  atcoder: {
    id: "atcoder",
    name: "AtCoder",
    profileUrl: (handle) => `https://atcoder.jp/users/${encodeURIComponent(handle)}`,
    handleHint: "chokudai",
    handlePattern: /^[A-Za-z0-9_]{3,16}$/,
    history: "full",
  },
  leetcode: {
    id: "leetcode",
    name: "LeetCode",
    profileUrl: (handle) => `https://leetcode.com/u/${encodeURIComponent(handle)}/`,
    handleHint: "your-leetcode-username",
    handlePattern: /^[A-Za-z0-9_-]{1,30}$/,
    history: "recent_only",
    note: "LeetCode only shares counts and your 20 most recent solves publicly.",
  },
};

/** Display order on the connect page. */
export const PLATFORM_ORDER: PlatformId[] = ["codeforces", "atcoder", "leetcode"];
