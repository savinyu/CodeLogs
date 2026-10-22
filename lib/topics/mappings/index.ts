import type { PlatformId } from "@/lib/adapters/types";
import { isMacro, macroOf, type TopicSlug } from "../taxonomy";
import { CODEFORCES_TAGS } from "./codeforces";
import { INTERVIEWBIT_TAGS, interviewbitTagKey } from "./interviewbit";
import { LEETCODE_TAGS } from "./leetcode";

const NONE: readonly TopicSlug[] = [];

function tableFor(platform: PlatformId): Readonly<Record<string, readonly TopicSlug[]>> | null {
  if (platform === "codeforces") return CODEFORCES_TAGS;
  if (platform === "leetcode") return LEETCODE_TAGS;
  if (platform === "interviewbit") return INTERVIEWBIT_TAGS;
  return null; // AtCoder and the other extension platforms send no tags
}

/** Topics for one raw platform tag; [] for unknown or deliberately unmapped tags, and for platforms without tags. */
export function topicsForTag(platform: PlatformId, tag: string): readonly TopicSlug[] {
  const table = tableFor(platform);
  const key = platform === "interviewbit" ? interviewbitTagKey(tag) : tag;
  if (!table || !Object.hasOwn(table, key)) return NONE;
  return table[key] ?? NONE;
}

/**
 * Every tag of a platform that maps into the given topic or any of its micros (for the
 * recommendation SQL, which only queries CF and LC). InterviewBit's come back as table keys.
 */
export function tagsForTopic(platform: PlatformId, slug: TopicSlug): string[] {
  const table = tableFor(platform);
  if (!table) return [];
  const wantMacro = isMacro(slug);
  return Object.entries(table)
    .filter(([, slugs]) => slugs.some((s) => (wantMacro ? macroOf(s) === slug : s === slug)))
    .map(([tag]) => tag);
}
