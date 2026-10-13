// Topic coverage and weak-topic scoring. Pure: queries.ts feeds it rows, tests feed it fixtures.
//
// For each topic and platform we compare what you solved with what you'd expect if your solves
// mirrored the platform's catalog:
//   expected = (your solves on the platform) × (share of catalog problems in the topic)
//   coverage = (solved + K) / (expected + K)          K smooths small numbers
// Codeforces works per problem: each solve is weighted by its rating against your level, and the
// catalog is limited to problems up to your level + LEVEL_HEADROOM, so a newcomer isn't "weak"
// at flows. LeetCode only publishes lifetime per-tag counts (never per problem), so a topic's
// count is the sum of its tags' counts, scaled by how much those tags overlap in the catalog,
// and only the tags LeetCode counts are used on both sides.

import type { PlatformId } from "@/lib/adapters/types";
import type { MacroTopicStat, TopicPlatformStat, TopicStat } from "@/lib/dashboard/types";
import { topicsForTag } from "./mappings";
import { LEETCODE_COUNTED_TAGS } from "./mappings/leetcode";
import { macroOf, TAXONOMY, type MacroSlug, type TopicSlug } from "./taxonomy";

/** Smoothing for coverage, in problems. */
const K = 2;
/** A topic needs this many expected solves before it can be called weak. */
export const MIN_EXPECTED = 2;
/** Coverage below this is weak. */
export const WEAK_BELOW = 0.8;
/** Codeforces catalog problems count toward expectations up to your level plus this. */
export const LEVEL_HEADROOM = 300;
/** Level used when there's no CF rating and no rated solve. */
const DEFAULT_LEVEL = 1200;

/** One group of catalog problems that share exactly the same tags. */
export interface TagSetCount {
  tags: string[];
  count: number;
}

export interface ScoringInput {
  /** Codeforces solves with tags and rating (null = unrated). Empty when CF isn't connected. */
  cfSolves: { tags: string[]; rating: number | null }[];
  /** cfLevel() of the user; null when CF isn't connected. */
  cfLevel: number | null;
  /** CF catalog problems rated up to cfLevel + LEVEL_HEADROOM. */
  cfCatalog: TagSetCount[];
  /** LeetCode lifetime solved count per tag; null when LeetCode hasn't reported them. */
  lcTagCounts: { tag: string; solved: number }[] | null;
  /** LeetCode lifetime solved total. */
  lcSolved: number;
  /** Free LeetCode catalog problems. */
  lcCatalog: TagSetCount[];
}

/**
 * The CF rating recommendations and weights are pitched at: the current rating, else the median
 * rated solve, else DEFAULT_LEVEL.
 */
export function cfLevel(rating: number | null | undefined, solvedRatings: number[]): number {
  if (rating != null && rating > 0) return rating;
  const sorted = solvedRatings.filter((r) => r > 0).sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? DEFAULT_LEVEL;
}

/** Highest CF catalog rating that counts toward expectations, rounded to CF's 100 steps. */
export function cfCatalogCap(level: number): number {
  return Math.round((level + LEVEL_HEADROOM) / 100) * 100;
}

/** A solve well below your level counts less; one above it counts a bit more. */
export function ratingWeight(rating: number | null, level: number): number {
  if (rating === null) return 0.75;
  return Math.min(1.25, Math.max(0.25, 1 + (rating - level) / 800));
}

/** Topics (macros and micros) a set of tags touches, each once. */
function topicsOf(platform: PlatformId, tags: string[]): Set<TopicSlug> {
  const out = new Set<TopicSlug>();
  for (const tag of tags) {
    for (const slug of topicsForTag(platform, tag)) {
      out.add(slug);
      out.add(macroOf(slug));
    }
  }
  return out;
}

/** Per topic: problems that touch it, and the sum of their tags that map into it. */
function catalogShares(platform: PlatformId, catalog: TagSetCount[]) {
  let size = 0;
  const problems = new Map<TopicSlug, number>();
  const hits = new Map<TopicSlug, number>();
  for (const { tags, count } of catalog) {
    size += count;
    for (const slug of topicsOf(platform, tags)) {
      problems.set(slug, (problems.get(slug) ?? 0) + count);
    }
    for (const tag of new Set(tags)) {
      const touched = new Set<TopicSlug>();
      for (const slug of topicsForTag(platform, tag)) touched.add(slug).add(macroOf(slug));
      for (const slug of touched) hits.set(slug, (hits.get(slug) ?? 0) + count);
    }
  }
  return { size, problems, hits };
}

type Contribution = Map<TopicSlug, TopicPlatformStat>;

function codeforcesContribution(input: ScoringInput): Contribution | null {
  if (input.cfLevel === null) return null;
  const level = input.cfLevel;
  const out: Contribution = new Map();
  const catalog = catalogShares("codeforces", input.cfCatalog);
  let total = 0;
  const solved = new Map<TopicSlug, { n: number; w: number }>();
  for (const s of input.cfSolves) {
    const w = ratingWeight(s.rating, level);
    total += w;
    for (const slug of topicsOf("codeforces", s.tags)) {
      const acc = solved.get(slug) ?? { n: 0, w: 0 };
      solved.set(slug, { n: acc.n + 1, w: acc.w + w });
    }
  }
  for (const slug of allSlugs()) {
    const share = catalog.size ? (catalog.problems.get(slug) ?? 0) / catalog.size : 0;
    const s = solved.get(slug);
    out.set(slug, {
      platform: "codeforces",
      solved: s?.n ?? 0,
      weighted: s?.w ?? 0,
      expected: total * share,
    });
  }
  return out;
}

function leetcodeContribution(input: ScoringInput): Contribution | null {
  if (!input.lcTagCounts) return null;
  const out: Contribution = new Map();
  // Only tags LeetCode counts per user, or the catalog would expect solves we can never see.
  const counted = input.lcCatalog.map(({ tags, count }) => ({
    tags: tags.filter((t) => LEETCODE_COUNTED_TAGS.has(t)),
    count,
  }));
  const catalog = catalogShares("leetcode", counted);
  const tagHits = new Map<TopicSlug, number>();
  for (const { tag, solved } of input.lcTagCounts) {
    if (solved <= 0) continue;
    const touched = new Set<TopicSlug>();
    for (const slug of topicsForTag("leetcode", tag)) touched.add(slug).add(macroOf(slug));
    for (const slug of touched) tagHits.set(slug, (tagHits.get(slug) ?? 0) + solved);
  }
  for (const slug of allSlugs()) {
    const problems = catalog.problems.get(slug) ?? 0;
    const hits = catalog.hits.get(slug) ?? 0;
    // Tags overlap (a problem can be both "graph" and "breadth-first-search"); the catalog tells
    // us by how much, so the summed tag counts are scaled back to an estimate of problems.
    const overlap = hits ? problems / hits : 1;
    const estimate = (tagHits.get(slug) ?? 0) * overlap;
    out.set(slug, {
      platform: "leetcode",
      solved: Math.round(estimate),
      weighted: estimate,
      expected: catalog.size ? (input.lcSolved * problems) / catalog.size : 0,
    });
  }
  return out;
}

function allSlugs(): TopicSlug[] {
  return TAXONOMY.flatMap((m) => [m.slug, ...m.micros.map((u) => u.slug)]);
}

/**
 * Every macro topic in taxonomy order, with micros, each carrying one entry per platform that
 * has topic data (CF solves, LC tag counts). AtCoder has no tags and never appears.
 */
export function buildTopicStats(input: ScoringInput): MacroTopicStat[] {
  const contributions = [codeforcesContribution(input), leetcodeContribution(input)].filter(
    (c): c is Contribution => c !== null,
  );
  const stat = (slug: TopicSlug, name: string): TopicStat => ({
    slug,
    name,
    platforms: contributions.map((c) => c.get(slug)!),
  });
  return TAXONOMY.map((m) => ({
    ...stat(m.slug, m.name),
    slug: m.slug,
    micros: m.micros.map((u) => stat(u.slug, u.name)),
  }));
}

export interface TopicScore {
  /** Problems solved (LeetCode's part is an estimate). */
  solved: number;
  /** Solves at the catalog's share, for your volume. */
  expected: number;
  /** (weighted + K) / (expected + K): 1 = on par with the catalog; below WEAK_BELOW is weak. */
  coverage: number;
}

/** Sums a topic over the platforms it lists (filter platforms out first to narrow it). */
export function scoreTopic(topic: TopicStat): TopicScore {
  let solved = 0;
  let weighted = 0;
  let expected = 0;
  for (const p of topic.platforms) {
    solved += p.solved;
    weighted += p.weighted;
    expected += p.expected;
  }
  return { solved, expected, coverage: (weighted + K) / (expected + K) };
}

/** Problems short of the expectation, in coverage-consistent units. */
function deficit(s: TopicScore): number {
  return (s.expected + K) * (1 - s.coverage);
}

export interface WeakTopic extends TopicScore {
  slug: MacroSlug;
  name: string;
  /** The micro topic furthest behind its expectation (in problems), to focus practice on. */
  focus: { slug: TopicSlug; name: string } | null;
}

/** Up to `limit` macro topics with coverage below WEAK_BELOW, weakest first. */
export function weakTopics(topics: MacroTopicStat[], limit = 3): WeakTopic[] {
  return topics
    .map((t) => ({ t, score: scoreTopic(t) }))
    .filter(({ score }) => score.expected >= MIN_EXPECTED && score.coverage < WEAK_BELOW)
    .sort((a, b) => a.score.coverage - b.score.coverage)
    .slice(0, limit)
    .map(({ t, score }) => {
      const focus = t.micros
        .map((u) => ({ u, s: scoreTopic(u) }))
        .filter(({ s }) => s.expected >= 1 && s.coverage < WEAK_BELOW)
        .sort((a, b) => deficit(b.s) - deficit(a.s))[0];
      return {
        slug: t.slug,
        name: t.name,
        ...score,
        focus: focus ? { slug: focus.u.slug, name: focus.u.name } : null,
      };
    });
}
