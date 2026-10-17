import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { SocialKind } from "../social-links-shared";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Better Auth tables (usePlural). Property names are the field names Better Auth
// expects; don't rename them. Extra user fields are declared in lib/auth.ts too.
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    /** GitHub login at sign-up; used for /u/<username>. */
    username: text("username").unique(),
    publicProfile: boolean("public_profile").notNull().default(false),
    /** Today page goal: activity per UTC day, 1–20 (v2). */
    dailyGoal: smallint("daily_goal").notNull().default(3),
    /** Opt-in to the global weekly board; only counts while publicProfile is on (v2). */
    globalBoard: boolean("global_board").notNull().default(false),
  },
  (t) => [check("users_daily_goal_range", sql`${t.dailyGoal} between 1 and 20`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** OAuth links (GitHub). Not to be confused with platform_accounts. */
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// CodeLogs tables
// ---------------------------------------------------------------------------

/** Links shown on the profile, one per kind. GitHub isn't stored: it's users.username. */
export const socialLinks = pgTable(
  "social_links",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SocialKind>().notNull(),
    /** A handle for x/instagram, an https URL for website, an address for email. */
    value: text("value").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

/**
 * Personal tokens for the browser extension (M8). Only a SHA-256 hash is stored; the token is
 * shown once when created. Deleting a row revokes it.
 */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    /** The first characters of the token ("cl_AbCd12"), so the user can tell tokens apart. */
    tokenPrefix: text("token_prefix").notNull(),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("api_tokens_user_id_idx").on(t.userId)],
);

export const PLATFORMS = ["codeforces", "atcoder", "leetcode"] as const;
export const platformEnum = pgEnum("platform", PLATFORMS);

/** pending = added, never synced. partial = synced but the platform only exposes part of the history. */
export const accountStatusEnum = pgEnum("account_status", [
  "pending",
  "syncing",
  "ok",
  "partial",
  "error",
]);
export const solveSourceEnum = pgEnum("solve_source", ["api", "import", "extension"]);
export const runStatusEnum = pgEnum("run_status", ["running", "ok", "error"]);

/** A user's handle on one coding platform. One per platform per user. */
export const platformAccounts = pgTable(
  "platform_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    handle: text("handle").notNull(),
    verified: boolean("verified").notNull().default(false),
    verifyToken: text("verify_token"),
    status: accountStatusEnum("status").notNull().default("pending"),
    /** Adapter-specific; see SyncCursor in lib/adapters/types.ts. */
    syncCursor: jsonb("sync_cursor"),
    historyComplete: boolean("history_complete").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /** When the last sync was queued: drives the "Sync now" cooldown and stuck-sync recovery. */
    syncRequestedAt: timestamp("sync_requested_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("platform_accounts_user_platform_uq").on(t.userId, t.platform)],
);

/** Global problem catalog. Rows with catalogUpdatedAt = null are stubs written by a user sync. */
export const problems = pgTable(
  "problems",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    /** As the platform reports it: CF rating "800", AtCoder model "-342", LC "Medium". */
    difficultyRaw: text("difficulty_raw"),
    /** 1 (easiest) to 5; null = unrated. */
    difficultyNorm: smallint("difficulty_norm"),
    rawTags: jsonb("raw_tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** LeetCode premium; kept out of recommendations. */
    paidOnly: boolean("paid_only").notNull().default(false),
    catalogUpdatedAt: timestamp("catalog_updated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("problems_platform_external_uq").on(t.platform, t.externalId)],
);

export const catalogSyncs = pgTable("catalog_syncs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  platform: platformEnum("platform").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: runStatusEnum("status").notNull().default("running"),
  rows: integer("rows"),
  error: text("error"),
});

/** One row per (user, problem): the first time we know it was accepted. */
export const solves = pgTable(
  "solves",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Removing a platform account removes its solves. */
    accountId: uuid("account_id")
      .notNull()
      .references(() => platformAccounts.id, { onDelete: "cascade" }),
    problemId: bigint("problem_id", { mode: "number" })
      .notNull()
      .references(() => problems.id),
    firstSolvedAt: timestamp("first_solved_at", { withTimezone: true }),
    source: solveSourceEnum("source").notNull().default("api"),
  },
  (t) => [
    uniqueIndex("solves_user_problem_uq").on(t.userId, t.problemId),
    index("solves_account_idx").on(t.accountId),
  ],
);

/** Trimmed API responses kept for debugging and re-parsing. */
export const rawPayloads = pgTable(
  "raw_payloads",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => platformAccounts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [index("raw_payloads_account_idx").on(t.accountId, t.kind)],
);

/** Submission counts per UTC day, from LC calendars or derived from solve timestamps. */
export const activityDays = pgTable(
  "activity_days",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => platformAccounts.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.day] })],
);

/** Latest snapshot per kind: LC difficulty/tag counts, CF rating, etc. */
export const platformStats = pgTable(
  "platform_stats",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => platformAccounts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.kind] })],
);

/**
 * Contests an account took part in (CF user.rating, LC contest history). Each sync replaces the
 * account's set; only changed rows are rewritten.
 */
export const contestResults = pgTable(
  "contest_results",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => platformAccounts.id, { onDelete: "cascade" }),
    /** CF contest id, LC contest slug. */
    contestKey: text("contest_key").notNull(),
    name: text("name").notNull(),
    /** CF: rating update time (the contest's end); LC: the contest's start. */
    heldAt: timestamp("held_at", { withTimezone: true }).notNull(),
    rank: integer("rank"),
    oldRating: integer("old_rating"),
    newRating: integer("new_rating"),
    rated: boolean("rated").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.contestKey] })],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => platformAccounts.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: runStatusEnum("status").notNull().default("running"),
    error: text("error"),
    items: integer("items"),
  },
  (t) => [index("sync_runs_account_idx").on(t.accountId, t.startedAt)],
);

// ---------------------------------------------------------------------------
// v2 tables (PLAN-v2.md §5)
// ---------------------------------------------------------------------------

/** "Mark done" on a Today pick, for one UTC day. Synced solves tick picks without a row. */
export const dailyMarks = pgTable(
  "daily_marks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.platform, t.externalId] })],
);

/** Explicit follow choices only; with no row, lib/sheets/follow.ts gives the default. */
export const sheetFollows = pgTable(
  "sheet_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sheetId: text("sheet_id").notNull(),
    following: boolean("following").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sheetId] })],
);

/** Manual "Solved it" ticks, by LeetCode slug. They count inside sheets only. */
export const sheetTicks = pgTable(
  "sheet_ticks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.slug] })],
);

export const friendshipStatusEnum = pgEnum("friendship_status", ["pending", "accepted"]);

/**
 * One row per pair of users, whoever asked first. Declining, cancelling or removing deletes the
 * row, so the other person isn't told.
 */
export const friendships = pgTable(
  "friendships",
  {
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.requesterId, t.addresseeId] }),
    uniqueIndex("friendships_pair_uq").on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`,
    ),
    index("friendships_addressee_idx").on(t.addresseeId),
    check("friendships_not_self", sql`${t.requesterId} <> ${t.addresseeId}`),
  ],
);

/** Two-level taxonomy: macro topics have parentId = null. */
export const topics = pgTable("topics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => topics.id),
});

export const tagMappings = pgTable(
  "tag_mappings",
  {
    platform: platformEnum("platform").notNull(),
    rawTag: text("raw_tag").notNull(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.platform, t.rawTag] })],
);

export type User = typeof users.$inferSelect;
export type PlatformAccount = typeof platformAccounts.$inferSelect;
export type Problem = typeof problems.$inferSelect;
