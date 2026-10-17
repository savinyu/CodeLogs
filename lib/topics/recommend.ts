// "Solve next": unsolved problems for the weak topics, or for the lowest-coverage topics when none
// is weak (see practiceTopics). Codeforces is the primary source (rated +100–200 above your
// level); LeetCode picks can't see solves older than the recent 20, so they carry maybeSolved
// until the account's history is complete (M5 backfill).

import "server-only";
import { and, eq, not, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { problems, solves } from "@/lib/db/schema";
import type { DashboardData } from "@/lib/dashboard/types";
import { tagsForTopic } from "./mappings";
import { practiceTopics, type WeakTopic } from "./scoring";

export interface Recommendation {
  platform: "codeforces" | "leetcode";
  externalId: string;
  title: string;
  url: string;
  /** CF rating "1100" or LC "Medium". */
  difficultyRaw: string | null;
  tags: string[];
  /** LeetCode only: we can't rule out an old solve we never saw. */
  maybeSolved: boolean;
  /** Solved (a dated solve) on or after `keepSolvedSince`; false when that option is omitted. */
  solvedToday: boolean;
}

export interface TopicPicks extends WeakTopic {
  problems: Recommendation[];
}

/** LeetCode users below this many solves get Easy picks; Medium otherwise. */
const LC_EASY_UNTIL = 50;

function hasAny(tags: string[]): SQL {
  if (tags.length === 0) return sql`false`;
  return sql`${problems.rawTags} ?| ARRAY[${sql.join(
    tags.map((t) => sql`${t}`),
    sql`, `,
  )}]::text[]`;
}

/** Order term putting problems with a focus tag first; none without focus tags (Postgres
 * rejects a constant in ORDER BY). */
function focusFirst(tags: string[]): SQL[] {
  return tags.length ? [sql`${hasAny(tags)} DESC`] : [];
}

/** The CF rating as an int; null for anything non-numeric (the CASE guards the cast). */
export function ratingOf(): SQL<number | null> {
  return sql<number | null>`(CASE WHEN ${problems.difficultyRaw} ~ '^[0-9]+$'
    THEN ${problems.difficultyRaw}::int END)`;
}

/** Start of a UTC day (YYYY-MM-DD) as a timestamptz. */
function dayStart(day: string): SQL {
  return sql`(${`${day}T00:00:00Z`})::timestamptz`;
}

/**
 * Not solved by the user. With `since`, a solve dated on or after that day doesn't count, so a
 * pick solved today stays in the set; undated solves still count as solved.
 */
function unsolvedBy(userId: string, since?: string): SQL {
  const old = since
    ? sql` AND (${solves.firstSolvedAt} IS NULL OR ${solves.firstSolvedAt} < ${dayStart(since)})`
    : sql``;
  return sql`NOT EXISTS (SELECT 1 FROM ${solves}
    WHERE ${solves.userId} = ${userId} AND ${solves.problemId} = ${problems.id}${old})`;
}

function columnsFor(userId: string, since?: string) {
  return {
    externalId: problems.externalId,
    title: problems.title,
    url: problems.url,
    difficultyRaw: problems.difficultyRaw,
    tags: problems.rawTags,
    solvedToday: since
      ? sql<boolean>`EXISTS (SELECT 1 FROM ${solves}
          WHERE ${solves.userId} = ${userId} AND ${solves.problemId} = ${problems.id}
          AND ${solves.firstSolvedAt} >= ${dayStart(since)})`
      : sql<boolean>`false`,
  };
}

/** CF's band for a level: 839 → 1000–1100 (ratings are multiples of 100). */
export function codeforcesBand(level: number): { lo: number; hi: number } {
  return { lo: Math.ceil((level + 100) / 100) * 100, hi: Math.ceil((level + 200) / 100) * 100 };
}

async function codeforcesPicks(
  userId: string,
  level: number,
  topic: WeakTopic,
  seed: string,
  limit: number,
  since?: string,
) {
  const tags = tagsForTopic("codeforces", topic.slug);
  if (tags.length === 0) return [];
  const focus = topic.focus ? tagsForTopic("codeforces", topic.focus.slug) : [];
  const { lo, hi } = codeforcesBand(level);
  const rating = ratingOf();
  return db
    .select(columnsFor(userId, since))
    .from(problems)
    .where(
      and(
        eq(problems.platform, "codeforces"),
        // Nearest bands first (ORDER BY), but allow a little either side so a thin topic still
        // gets picks.
        sql`${rating} BETWEEN ${lo - 200} AND ${hi + 300}`,
        hasAny(tags),
        not(sql`${problems.rawTags} ? '*special'`),
        unsolvedBy(userId, since),
      ),
    )
    .orderBy(
      sql`${rating} BETWEEN ${lo} AND ${hi} DESC`,
      sql`abs(${rating} - ${(lo + hi) / 2})`,
      ...focusFirst(focus),
      sql`md5(${problems.externalId} || ${seed})`,
    )
    .limit(limit);
}

async function leetcodePicks(
  userId: string,
  difficulty: "Easy" | "Medium",
  topic: WeakTopic,
  seed: string,
  limit: number,
  since?: string,
) {
  const tags = tagsForTopic("leetcode", topic.slug);
  if (tags.length === 0) return [];
  const focus = topic.focus ? tagsForTopic("leetcode", topic.focus.slug) : [];
  return db
    .select(columnsFor(userId, since))
    .from(problems)
    .where(
      and(
        eq(problems.platform, "leetcode"),
        eq(problems.difficultyRaw, difficulty),
        not(problems.paidOnly),
        hasAny(tags),
        unsolvedBy(userId, since),
      ),
    )
    .orderBy(...focusFirst(focus), sql`md5(${problems.externalId} || ${seed})`)
    .limit(limit);
}

/**
 * Picks for the weak topics (else the lowest-coverage ones) of an already platform-filtered
 * dashboard. Picks rotate daily (seeded by user and day) and a problem shows under one topic only.
 * `keepSolvedSince` (YYYY-MM-DD, UTC) keeps problems solved on or after that day in the picks,
 * flagged `solvedToday`, so the set doesn't reshuffle as the day's solves sync.
 */
export async function getSolveNext(
  userId: string,
  data: DashboardData,
  options: { keepSolvedSince?: string } = {},
): Promise<TopicPicks[]> {
  const since = options.keepSolvedSince;
  const weak = practiceTopics(data.topics);
  if (weak.length === 0) return [];

  const lcAccount = data.accounts.find((a) => a.platform === "leetcode");
  const cfLevel = data.accounts.some((a) => a.platform === "codeforces") ? data.cfLevel : null;
  const lcSolved = data.totals.find((t) => t.platform === "leetcode")?.solved ?? 0;
  const cfCount = lcAccount ? 3 : 4;
  const lcCount = cfLevel !== null ? 2 : 4;
  const seed = `${userId}:${data.asOf}`;

  // Fetch extra so duplicates across topics can be dropped.
  const fetched = await Promise.all(
    weak.map(async (topic) => {
      const [cf, lc] = await Promise.all([
        cfLevel !== null ? codeforcesPicks(userId, cfLevel, topic, seed, cfCount + 3, since) : [],
        lcAccount
          ? leetcodePicks(
              userId,
              lcSolved < LC_EASY_UNTIL ? "Easy" : "Medium",
              topic,
              seed,
              lcCount + 3,
              since,
            )
          : [],
      ]);
      return { cf, lc };
    }),
  );

  const seen = new Set<string>();
  const take = (
    rows: Omit<Recommendation, "platform" | "maybeSolved">[],
    n: number,
    platform: Recommendation["platform"],
    maybeSolved: boolean,
  ) => {
    const out: Recommendation[] = [];
    for (const r of rows) {
      if (out.length === n) break;
      const key = `${platform}:${r.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...r, platform, maybeSolved });
    }
    return out;
  };

  return weak.map((topic, i) => ({
    ...topic,
    problems: [
      ...take(fetched[i]!.cf, cfCount, "codeforces", false),
      ...take(fetched[i]!.lc, lcCount, "leetcode", !lcAccount?.historyComplete),
    ],
  }));
}
