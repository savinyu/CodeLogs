// Platform adapter contract. Adapters are pure: HTTP in, normalized data out.
// They never import the DB, so fixture tests run without one. See PLAN.md §6.

import type { PLATFORMS } from "@/lib/db/schema";

export type PlatformId = (typeof PLATFORMS)[number];

/** full = every accepted problem; recent_only = counts + last N solves (LeetCode); counts_only = totals only. */
export type HistoryCompleteness = "full" | "recent_only" | "counts_only";

export interface ProblemFallback {
  title: string;
  url: string;
  difficultyRaw?: string | number;
  rawTags: string[];
}

export interface NormalizedSolve {
  platform: PlatformId;
  /** "1850A", "abc138_a", "two-sum" */
  externalProblemId: string;
  /** Earliest accepted time we know of; undefined if the platform doesn't say. */
  firstSolvedAt?: Date;
  /**
   * Problem metadata carried on the submission itself. Used to write a stub problem row
   * when the catalog doesn't have it (CF 1782A is missing from problemset.problems).
   */
  problemFallback?: ProblemFallback;
}

export interface PlatformExtra {
  /** e.g. "lc_difficulty_counts", "lc_tag_counts", "lc_calendar", "cf_rating" */
  kind: string;
  payload: unknown;
}

export interface PlatformSnapshot {
  /** Deduped within the page (CF by problem, AtCoder by submission id, LC by slug). */
  solves: NormalizedSolve[];
  extras: PlatformExtra[];
  /** Per-day submission counts (YYYY-MM-DD, UTC), when the platform provides a calendar. */
  activity?: { day: string; count: number }[];
}

/** Where the next incremental sync resumes. Stored in platform_accounts.sync_cursor. */
export type SyncCursor =
  | { platform: "codeforces"; maxSubmissionId: number }
  | { platform: "atcoder"; fromSecond: number }
  | { platform: "leetcode"; lastAcceptedAt: number };

/** Adapter-defined paging state between steps of one sync (CF: `from` offset; AtCoder: next from_second). */
export type PageToken = number;

export interface SyncPage {
  snapshot: PlatformSnapshot;
  /** null = done. Otherwise the sync job runs another step with this token. */
  nextPage: PageToken | null;
  /**
   * The cursor to persist once every page has succeeded. The sync job keeps the
   * latest non-null value it sees, so an adapter can report it on any page.
   */
  resumeCursor: SyncCursor | null;
}

export type ValidateResult =
  | { result: "valid"; canonicalHandle: string }
  | { result: "invalid"; message: string }
  /** Network error, 5xx or rate limit: let the user try again. */
  | { result: "retry"; message: string };

export interface PlatformCapabilities {
  history: HistoryCompleteness;
  /** Per-problem tags (CF, LC). */
  topicTags: boolean;
  /** Lifetime per-tag solve counts (LC). */
  topicCounts: boolean;
  activityCalendar: boolean;
}

export interface PlatformAdapter {
  platform: PlatformId;
  capabilities: PlatformCapabilities;
  /** Minimum gap between requests: CF 2000, AtCoder 1100, LC 1000. */
  minDelayMs: number;
  validateHandle(handle: string): Promise<ValidateResult>;
  /** CF organization, AtCoder affiliation, LC aboutMe. */
  readVerificationField(handle: string): Promise<string | null>;
  /** cursor = where the last completed sync stopped (null on first sync); page = token from the previous step. */
  fetchPage(handle: string, cursor: SyncCursor | null, page: PageToken | null): Promise<SyncPage>;
}

export interface CatalogProblem {
  platform: PlatformId;
  externalId: string;
  title: string;
  url: string;
  difficultyRaw?: string | number;
  rawTags: string[];
}

export interface CatalogAdapter {
  platform: PlatformId;
  /** Used only by the syncCatalogs cron. */
  fetchCatalog(): Promise<CatalogProblem[]>;
}
