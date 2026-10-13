import type { PlatformId } from "@/lib/adapters/types";
import { isMacro, macroOf, type TopicSlug } from "../taxonomy";
import { CODEFORCES_TAGS } from "./codeforces";
import { LEETCODE_TAGS } from "./leetcode";

const NONE: readonly TopicSlug[] = [];

function tableFor(platform: PlatformId): Readonly<Record<string, readonly TopicSlug[]>> | null {
  if (platform === "codeforces") return CODEFORCES_TAGS;
  if (platform === "leetcode") return LEETCODE_TAGS;
  return null; // AtCoder has no tags
}

/** Topics for one raw platform tag; [] for unknown or deliberately unmapped tags, and for AtCoder (no tags). */
export function topicsForTag(platform: PlatformId, tag: string): readonly TopicSlug[] {
  const table = tableFor(platform);
  if (!table || !Object.hasOwn(table, tag)) return NONE;
  return table[tag] ?? NONE;
}

/** Every raw tag of a platform that maps into the given topic or any of its micros (for the recommendation SQL). */
export function tagsForTopic(platform: PlatformId, slug: TopicSlug): string[] {
  const table = tableFor(platform);
  if (!table) return [];
  const wantMacro = isMacro(slug);
  return Object.entries(table)
    .filter(([, slugs]) => slugs.some((s) => (wantMacro ? macroOf(s) === slug : s === slug)))
    .map(([tag]) => tag);
}
