// @ts-check
// The platforms the extension syncs, in the order of lib/platforms.ts (LeetCode first, then the
// five that are read inside the platform's own tab).
import { codechef } from "./platforms/codechef.js";
import { code360 } from "./platforms/code360.js";
import { hackerrank } from "./platforms/hackerrank.js";
import { interviewbit } from "./platforms/interviewbit.js";
import { gfg } from "./platforms/gfg.js";

export const READERS = { codechef, code360, hackerrank, interviewbit, gfg };

/** @typedef {"leetcode" | keyof typeof READERS} SyncPlatformId */

/** @type {Array<{ id: SyncPlatformId, name: string, kind: "leetcode" | "page", permissions: string[] }>} */
export const SYNC_PLATFORMS = [
  { id: "leetcode", name: "LeetCode", kind: "leetcode", permissions: ["https://leetcode.com/*"] },
  ...[codechef, code360, hackerrank, interviewbit, gfg].map((r) => ({
    id: /** @type {keyof typeof READERS} */ (r.id),
    name: r.name,
    kind: /** @type {"page"} */ ("page"),
    permissions: r.permissions,
  })),
];

/** @param {unknown} id @returns {id is SyncPlatformId} */
export function isSyncPlatform(id) {
  return SYNC_PLATFORMS.some((p) => p.id === id);
}
