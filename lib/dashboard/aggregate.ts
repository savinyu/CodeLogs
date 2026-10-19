// Turns the raw rows from queries.ts into the dashboard view model, and filters it by platform.
// Pure (no DB), so tests can feed it rows directly.

import { z } from "zod";
import type { PlatformId } from "@/lib/adapters/types";
import { EXT_COUNTS_KIND } from "@/lib/extension-upload";
import { isExtensionPlatform, PLATFORM_ORDER } from "@/lib/platforms";
import { normalizeDifficulty } from "@/lib/sync/difficulty";
import { buildTopicStats, cfLevel, type TagSetCount } from "@/lib/topics/scoring";
import type {
  AccountSummary,
  ActivityDay,
  ContestEntry,
  ContestPlatform,
  DashboardData,
  DifficultyRow,
  LeetcodeBadge,
  PlatformContests,
  PlatformFilter,
  PlatformTotal,
  RecentSolve,
} from "./types";

type PlatformCount = { platform: PlatformId; count: number };
type PlatformDayCount = PlatformCount & { day: string };

export interface DashboardRaw {
  accounts: AccountSummary[];
  /** Solve rows per platform. */
  solveCounts: PlatformCount[];
  /** Latest platform_stats per account. */
  stats: { platform: PlatformId; kind: string; payload: unknown }[];
  /** New solves per UTC day, from solves.first_solved_at. */
  solveDays: PlatformDayCount[];
  /** Platform calendars (activity_days). A platform with any rows here uses them instead of solveDays. */
  calendarDays: PlatformDayCount[];
  difficulty: (PlatformCount & { band: number | null })[];
  /** Up to RECENT_LIMIT per platform, any order. */
  recent: RecentSolve[];
  /** Every Codeforces solve with its tags and raw rating, for topic scoring. */
  cfSolves: { tags: string[]; rating: string | null }[];
  /** CF catalog tag sets up to cfCatalogCap(level); LC catalog tag sets (free problems only). */
  cfCatalog: TagSetCount[];
  lcCatalog: TagSetCount[];
  /** contest_results rows of the user's accounts, any order. heldAt is an ISO timestamp. */
  contests: (Omit<ContestEntry, "url" | "platform"> & { platform: PlatformId })[];
}

/** Recent solves shown, overall or for one platform. */
export const RECENT_LIMIT = 15;

const cfRatingSchema = z.object({
  rating: z.number().nullable(),
  maxRating: z.number().nullable(),
  rank: z.string().nullable().optional(),
});
const lcDifficultySchema = z.object({
  solved: z.object({
    all: z.number().optional(),
    easy: z.number().optional(),
    medium: z.number().optional(),
    hard: z.number().optional(),
  }),
});
/** The extension platforms' own counts (lib/extension-upload.ts ExtCounts). */
const extCountsSchema = z.object({
  total: z.number(),
  split: z.object({ easy: z.number(), medium: z.number(), hard: z.number() }).nullable(),
});
type ExtSplit = NonNullable<z.infer<typeof extCountsSchema>["split"]>;
/** Where a reported Easy / Medium / Hard count lands in the five difficulty bands. */
const REPORTED_BAND = { easy: 1, medium: 3, hard: 4 } as const;
const lcTagCountsSchema = z.array(
  z.object({ tagSlug: z.string(), tagName: z.string(), problemsSolved: z.number() }),
);

const lcContestSchema = z.object({
  attended: z.number(),
  rating: z.number().nullable(),
  globalRanking: z.number().nullable(),
  topPercentage: z.number().nullable(),
  badge: z.string().nullable(),
});
const lcBadgesSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string().regex(/^https:\/\//),
    earnedAt: z.string().nullable(),
    category: z.string().nullable(),
  }),
);

function stat<T>(
  raw: Pick<DashboardRaw, "stats">,
  platform: PlatformId,
  kind: string,
  schema: z.ZodType<T>,
) {
  const row = raw.stats.find((s) => s.platform === platform && s.kind === kind);
  if (!row) return null;
  const parsed = schema.safeParse(row.payload);
  return parsed.success ? parsed.data : null;
}

/** YYYY-MM-DD plus n days (n may be negative), in UTC. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function inc<K extends string>(rec: Partial<Record<K, number>>, key: K, by: number) {
  rec[key] = (rec[key] ?? 0) + by;
}

function buildTotals(raw: DashboardRaw, connected: PlatformId[]): PlatformTotal[] {
  return connected.map((platform) => {
    const tracked = raw.solveCounts.find((c) => c.platform === platform)?.count ?? 0;
    const total: PlatformTotal = { platform, solved: tracked, source: "tracked", listed: tracked };

    if (platform === "leetcode") {
      const lc = stat(raw, platform, "lc_difficulty_counts", lcDifficultySchema)?.solved;
      if (lc?.all !== undefined) {
        Object.assign(total, { solved: lc.all, source: "reported" });
        if (lc.easy !== undefined && lc.medium !== undefined && lc.hard !== undefined) {
          total.split = { easy: lc.easy, medium: lc.medium, hard: lc.hard };
        }
      }
    }
    if (isExtensionPlatform(platform)) {
      const ext = stat(raw, platform, EXT_COUNTS_KIND, extCountsSchema);
      if (ext) {
        Object.assign(total, { solved: ext.total, source: "reported" });
        if (ext.split) total.split = { ...ext.split };
      }
    }
    if (platform === "codeforces") {
      const r = stat(raw, platform, "cf_rating", cfRatingSchema);
      if (r?.rating != null) {
        total.rating = {
          current: r.rating,
          max: r.maxRating ?? r.rating,
          ...(r.rank ? { rank: r.rank } : {}),
        };
      }
    }
    return total;
  });
}

function buildActivity(raw: DashboardRaw, asOf: string): ActivityDay[] {
  const withCalendar = new Set(raw.calendarDays.map((d) => d.platform));
  const rows = [...raw.calendarDays, ...raw.solveDays.filter((d) => !withCalendar.has(d.platform))];

  const byDay = new Map<string, ActivityDay>();
  for (const { platform, day, count } of rows) {
    if (day > asOf || count <= 0) continue;
    let entry = byDay.get(day);
    if (!entry) byDay.set(day, (entry = { day, counts: {}, total: 0 }));
    inc(entry.counts, platform, count);
    entry.total += count;
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function buildDifficulty(raw: DashboardRaw): DifficultyRow[] {
  const rows: DifficultyRow[] = ([1, 2, 3, 4, 5, null] as const).map((band) => ({
    band,
    counts: {},
    total: 0,
  }));
  const add = (platform: PlatformId, band: number | null, count: number) => {
    const row = rows.find((r) => r.band === band) ?? rows[5]!;
    inc(row.counts, platform, count);
    row.total += count;
  };

  // LeetCode's own lifetime split beats the handful of solve rows we hold.
  const lc = stat(raw, "leetcode", "lc_difficulty_counts", lcDifficultySchema)?.solved;
  // Extension platforms: the reported split, unless the solve rows already cover the total
  // (GFG's full list), so nothing is counted twice.
  const ext = new Map<PlatformId, ExtSplit>();
  for (const a of raw.accounts) {
    if (!isExtensionPlatform(a.platform)) continue;
    const counts = stat(raw, a.platform, EXT_COUNTS_KIND, extCountsSchema);
    const tracked = raw.solveCounts.find((c) => c.platform === a.platform)?.count ?? 0;
    if (counts?.split && tracked < counts.total) ext.set(a.platform, counts.split);
  }
  for (const r of raw.difficulty) {
    if (r.platform === "leetcode" && lc) continue;
    if (ext.has(r.platform)) continue;
    add(r.platform, r.band, r.count);
  }
  for (const [platform, split] of ext) {
    for (const level of ["easy", "medium", "hard"] as const) {
      if (split[level]) add(platform, REPORTED_BAND[level], split[level]);
    }
  }
  if (lc) {
    for (const level of ["easy", "medium", "hard"] as const) {
      const count = lc[level];
      if (count) add("leetcode", normalizeDifficulty("leetcode", level), count);
    }
  }
  return rows;
}

function cfRatingNumber(raw: string | null): number | null {
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
}

/** The CF level topic scoring uses, or null when Codeforces isn't connected. */
export function codeforcesLevel(
  raw: Pick<DashboardRaw, "stats" | "cfSolves"> & { accounts: { platform: PlatformId }[] },
): number | null {
  if (!raw.accounts.some((a) => a.platform === "codeforces")) return null;
  const rating = stat(raw, "codeforces", "cf_rating", cfRatingSchema)?.rating;
  const solved = raw.cfSolves.map((s) => cfRatingNumber(s.rating)).filter((r) => r !== null);
  return cfLevel(rating, solved);
}

function buildTopics(raw: DashboardRaw, level: number | null) {
  const lcTags = raw.accounts.some((a) => a.platform === "leetcode")
    ? stat(raw, "leetcode", "lc_tag_counts", lcTagCountsSchema)
    : null;
  return buildTopicStats({
    cfSolves: raw.cfSolves.map((s) => ({ tags: s.tags, rating: cfRatingNumber(s.rating) })),
    cfLevel: level,
    cfCatalog: raw.cfCatalog,
    lcTagCounts: lcTags?.map((t) => ({ tag: t.tagSlug, solved: t.problemsSolved })) ?? null,
    lcSolved: stat(raw, "leetcode", "lc_difficulty_counts", lcDifficultySchema)?.solved.all ?? 0,
    lcCatalog: raw.lcCatalog,
  });
}

export function contestUrl(platform: ContestPlatform, contestKey: string): string {
  const key = encodeURIComponent(contestKey);
  return platform === "codeforces"
    ? `https://codeforces.com/contest/${key}`
    : `https://leetcode.com/contest/${key}/`;
}

function isContestPlatform(p: PlatformId): p is ContestPlatform {
  return p === "codeforces" || p === "leetcode";
}

function buildContests(raw: DashboardRaw, connected: PlatformId[]): PlatformContests[] {
  return connected.filter(isContestPlatform).map((platform) => {
    const contests: ContestEntry[] = raw.contests
      .filter((c) => c.platform === platform)
      .sort((a, b) => a.heldAt.localeCompare(b.heldAt) || a.contestKey.localeCompare(b.contestKey))
      .map((c) => ({ ...c, platform, url: contestUrl(platform, c.contestKey) }));
    const ranks = contests.flatMap((c) => (c.rank !== null && c.rank > 0 ? [c.rank] : []));
    const ratings = contests.flatMap((c) => (c.newRating !== null ? [c.newRating] : []));
    const out: PlatformContests = {
      platform,
      contests,
      attended: contests.length,
      bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
      currentRating: ratings.at(-1) ?? null,
      maxRating: ratings.length > 0 ? Math.max(...ratings) : null,
    };
    if (platform === "leetcode") {
      const summary = stat(raw, platform, "lc_contest", lcContestSchema);
      if (summary?.rating != null) out.currentRating = Math.round(summary.rating);
      out.attended = Math.max(out.attended, summary?.attended ?? 0);
      out.globalRanking = summary?.globalRanking ?? null;
      out.topPercentage = summary?.topPercentage ?? null;
      out.badge = summary?.badge ?? null;
    }
    return out;
  });
}

/** Newest earned first; badges without a date keep LeetCode's order, after the dated ones. */
function buildLeetcodeBadges(raw: DashboardRaw, connected: PlatformId[]): LeetcodeBadge[] {
  if (!connected.includes("leetcode")) return [];
  const badges = stat(raw, "leetcode", "lc_badges", lcBadgesSchema) ?? [];
  return badges
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (y.b.earnedAt ?? "").localeCompare(x.b.earnedAt ?? "") || x.i - y.i)
    .map(({ b }) => b);
}

export function buildDashboard(raw: DashboardRaw, asOf: string): DashboardData {
  const accounts = PLATFORM_ORDER.flatMap((p) => raw.accounts.filter((a) => a.platform === p));
  const connected = accounts.map((a) => a.platform);
  const level = codeforcesLevel(raw);
  return {
    asOf,
    accounts,
    totals: buildTotals(raw, connected),
    activity: buildActivity(raw, asOf),
    difficulty: buildDifficulty(raw),
    topics: buildTopics(raw, level),
    cfLevel: level,
    // Newest first; undated solves last.
    recent: [...raw.recent].sort((a, b) => (b.solvedAt ?? "").localeCompare(a.solvedAt ?? "")),
    contests: buildContests(raw, connected),
    leetcodeBadges: buildLeetcodeBadges(raw, connected),
  };
}

export function parsePlatformFilter(value: unknown): PlatformFilter {
  return typeof value === "string" && (PLATFORM_ORDER as string[]).includes(value)
    ? (value as PlatformId)
    : "all";
}

/** Narrows every section to one platform, and trims recent solves to RECENT_LIMIT. */
export function filterDashboard(data: DashboardData, filter: PlatformFilter): DashboardData {
  if (filter === "all") return { ...data, recent: data.recent.slice(0, RECENT_LIMIT) };
  const only = <T extends { platform: PlatformId }>(rows: T[]) =>
    rows.filter((r) => r.platform === filter);
  const pick = (counts: Partial<Record<PlatformId, number>>) => {
    const n = counts[filter] ?? 0;
    return { counts: n ? { [filter]: n } : {}, total: n };
  };
  return {
    ...data,
    accounts: only(data.accounts),
    totals: only(data.totals),
    activity: data.activity.map((d) => ({ day: d.day, ...pick(d.counts) })).filter((d) => d.total),
    difficulty: data.difficulty.map((r) => ({ band: r.band, ...pick(r.counts) })),
    topics: data.topics.map((t) => ({
      ...t,
      platforms: only(t.platforms),
      micros: t.micros.map((u) => ({ ...u, platforms: only(u.platforms) })),
    })),
    recent: only(data.recent).slice(0, RECENT_LIMIT),
    contests: only(data.contests),
    leetcodeBadges: filter === "leetcode" ? data.leetcodeBadges : [],
  };
}
