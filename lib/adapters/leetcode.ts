// LeetCode adapter: public GraphQL, anonymous, low volume. See scripts/spike/FINDINGS.md.
// Pure: HTTP in, normalized data out. No DB, env or server-only imports.
//
// Quirks that shape this file:
// - One failing field nulls the whole `matchedUser` object, so every request asks for one thing.
// - An unknown user is HTTP 200 with `errors[0].message` and `data.matchedUser === null`.
// - Handles always travel as GraphQL variables, never interpolated into the query text.
// - History is "recent_only": counts + the last 20 accepted submissions (re-solves repeat).
//
// PageToken semantics for fetchPage (one HTTP request per call):
//   null | 0  stats: solved/total counts per difficulty             -> extra lc_difficulty_counts, next 1
//   1         lifetime per-tag solve counts                         -> extra lc_tag_counts,         next 2
//   2         recentAcSubmissionList(limit: 20)                     -> solves + resumeCursor,       next 4
//   4         userContestRanking                                    -> extra lc_contest,            next 5
//   5         userContestRankingHistory                             -> snapshot.contests,           next 6
//   6         matchedUser.badges                                    -> extra lc_badges,             next 3
//   3         userCalendar, rolling last year                       -> activity + extra lc_calendar,
//                                                                     next = newest earlier active year
//                                                                     on the FIRST sync (cursor null),
//                                                                     else null (incremental stops here)
//   Y >= 2000 userCalendar(year: Y)                                 -> activity for year Y,
//                                                                     next = largest activeYear < Y, or null

import { isRetryableError, requestJson } from "@/lib/adapters/http";
import { PlatformUserNotFoundError } from "@/lib/adapters/errors";
import type {
  CatalogAdapter,
  CatalogProblem,
  NormalizedSolve,
  LcBadge,
  LcContestSummary,
  NormalizedContest,
  PageToken,
  PlatformAdapter,
  PlatformExtra,
  SyncCursor,
  SyncPage,
  ValidateResult,
} from "@/lib/adapters/types";

const GRAPHQL_URL = "https://leetcode.com/graphql";
const PROBLEM_URL = "https://leetcode.com/problems/";
const MIN_DELAY_MS = 1000;
const RECENT_AC_LIMIT = 20;
const CATALOG_PAGE_SIZE = 100; // LeetCode silently caps the page size at 100.
const CATALOG_MAX_PAGES = 100;
const FIRST_YEAR_TOKEN = 2000;

const PAGE_STATS = 0;
const PAGE_TAGS = 1;
const PAGE_RECENT = 2;
const PAGE_CALENDAR = 3;
const PAGE_CONTEST = 4;
const PAGE_CONTEST_HISTORY = 5;
const PAGE_BADGES = 6;
const SITE_ORIGIN = "https://leetcode.com";

// The default CodeLogs User-Agent from http.ts is accepted by leetcode.com (verified live in M2),
// so no override is needed here.
const HEADERS = { Referer: "https://leetcode.com" };

// ---------------------------------------------------------------------------------------------
// Raw response shapes (only the fields we read)
// ---------------------------------------------------------------------------------------------

interface GqlError {
  message?: string;
}

interface GqlResponse<T> {
  data?: T | null;
  errors?: GqlError[];
}

interface DifficultyCount {
  difficulty: string;
  count: number;
  submissions?: number;
}

interface StatsData {
  allQuestionsCount?: DifficultyCount[] | null;
  matchedUser?: {
    submitStatsGlobal?: { acSubmissionNum?: DifficultyCount[] | null } | null;
  } | null;
}

interface RawTagCount {
  tagName: string;
  tagSlug: string;
  problemsSolved: number;
}

type TagLevel = "fundamental" | "intermediate" | "advanced";

interface TagCountsData {
  matchedUser?: {
    tagProblemCounts?: Partial<Record<TagLevel, RawTagCount[] | null>> | null;
  } | null;
}

interface RawRecentAc {
  id?: string;
  title: string;
  titleSlug: string;
  timestamp: string | number;
}

interface RecentAcData {
  recentAcSubmissionList?: RawRecentAc[] | null;
}

interface RawUserCalendar {
  activeYears?: number[] | null;
  streak?: number | null;
  totalActiveDays?: number | null;
  submissionCalendar?: string | null;
}

interface CalendarData {
  matchedUser?: { userCalendar?: RawUserCalendar | null } | null;
}

interface ContestRankingData {
  userContestRanking?: {
    attendedContestsCount?: number | null;
    rating?: number | null;
    globalRanking?: number | null;
    totalParticipants?: number | null;
    topPercentage?: number | null;
    badge?: { name?: string | null } | null;
  } | null;
}

interface RawContestHistoryRow {
  attended?: boolean | null;
  rating?: number | null;
  ranking?: number | null;
  contest?: { title?: string | null; titleSlug?: string | null; startTime?: number | null } | null;
}

interface ContestHistoryData {
  userContestRankingHistory?: RawContestHistoryRow[] | null;
}

interface RawBadge {
  id?: string | number | null;
  displayName?: string | null;
  icon?: string | null;
  creationDate?: string | null;
  category?: string | null;
}

interface BadgesData {
  matchedUser?: { badges?: RawBadge[] | null } | null;
}

interface ProfileData {
  matchedUser?: { username?: string; profile?: { aboutMe?: string | null } | null } | null;
}

interface RawCatalogQuestion {
  title: string;
  titleSlug: string;
  difficulty: string;
  paidOnly?: boolean;
  topicTags?: { name?: string; slug: string }[] | null;
}

interface CatalogData {
  problemsetQuestionList?: {
    total?: number | null;
    questions?: RawCatalogQuestion[] | null;
  } | null;
}

// ---------------------------------------------------------------------------------------------
// GraphQL plumbing
// ---------------------------------------------------------------------------------------------

const Q_STATS = `query ($username: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $username) { submitStatsGlobal { acSubmissionNum { difficulty count submissions } } }
}`;

const TAG_FIELDS = "{ tagName tagSlug problemsSolved }";
const Q_TAGS = `query ($username: String!) {
  matchedUser(username: $username) { tagProblemCounts { advanced ${TAG_FIELDS} intermediate ${TAG_FIELDS} fundamental ${TAG_FIELDS} } }
}`;

const Q_RECENT = `query ($username: String!, $limit: Int) {
  recentAcSubmissionList(username: $username, limit: $limit) { id title titleSlug timestamp }
}`;

const CAL_FIELDS = "{ activeYears streak totalActiveDays submissionCalendar }";
const Q_CALENDAR = `query ($username: String!) {
  matchedUser(username: $username) { userCalendar ${CAL_FIELDS} }
}`;
const Q_CALENDAR_YEAR = `query ($username: String!, $year: Int) {
  matchedUser(username: $username) { userCalendar(year: $year) ${CAL_FIELDS} }
}`;

const Q_CONTEST = `query ($username: String!) { userContestRanking(username: $username) { attendedContestsCount rating globalRanking totalParticipants topPercentage badge { name } } }`;
const Q_CONTEST_HISTORY = `query ($username: String!) { userContestRankingHistory(username: $username) { attended rating ranking contest { title titleSlug startTime } } }`;
const Q_BADGES = `query ($username: String!) { matchedUser(username: $username) { badges { id displayName icon creationDate category } } }`;

const Q_VALIDATE = `query ($username: String!) { matchedUser(username: $username) { username } }`;
const Q_PROFILE = `query ($username: String!) {
  matchedUser(username: $username) { username profile { aboutMe } }
}`;

const Q_CATALOG = `query ($limit: Int, $skip: Int) {
  problemsetQuestionList: questionList(categorySlug: "", limit: $limit, skip: $skip, filters: {}) {
    total: totalNum
    questions: data { title titleSlug difficulty paidOnly: isPaidOnly topicTags { name slug } }
  }
}`;

function gqlBody(query: string, variables: Record<string, unknown>): Record<string, unknown> {
  return { query, variables };
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  retries?: number,
): Promise<GqlResponse<T>> {
  return requestJson<GqlResponse<T>>(GRAPHQL_URL, {
    method: "POST",
    headers: HEADERS,
    body: gqlBody(query, variables),
    minIntervalMs: MIN_DELAY_MS,
    retries,
  });
}

function errorMessages(res: GqlResponse<unknown>): string {
  const msgs = (res.errors ?? []).map((e) => e.message).filter((m): m is string => !!m);
  return msgs.length > 0 ? msgs.join("; ") : "no data returned";
}

/** A response with no `data` object is a failure; `what` names the request for the message. */
function requireData<T>(res: GqlResponse<T>, what: string): T {
  if (!res.data) throw new Error(`LeetCode ${what} failed: ${errorMessages(res)}`);
  return res.data;
}

function unknownUser(handle: string): Error {
  return new PlatformUserNotFoundError(`No LeetCode user named "${handle}".`);
}

function titleCase(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function problemUrl(slug: string): string {
  return `${PROBLEM_URL}${slug}/`;
}

// ---------------------------------------------------------------------------------------------
// Page handlers
// ---------------------------------------------------------------------------------------------

interface DifficultyBuckets {
  all: number;
  easy: number;
  medium: number;
  hard: number;
}

function toBuckets(rows: DifficultyCount[]): DifficultyBuckets {
  const out: DifficultyBuckets = { all: 0, easy: 0, medium: 0, hard: 0 };
  for (const row of rows) {
    const key = row.difficulty.toLowerCase();
    if (key === "all" || key === "easy" || key === "medium" || key === "hard") {
      out[key] = row.count;
    }
  }
  return out;
}

async function fetchStats(handle: string): Promise<SyncPage> {
  const data = requireData(await gql<StatsData>(Q_STATS, { username: handle }), "stats");
  if (!data.matchedUser) throw unknownUser(handle);
  const solved = data.matchedUser.submitStatsGlobal?.acSubmissionNum;
  const total = data.allQuestionsCount;
  if (!solved || !total) throw new Error("LeetCode stats failed: response is missing counts");
  const extra: PlatformExtra = {
    kind: "lc_difficulty_counts",
    payload: { solved: toBuckets(solved), total: toBuckets(total) },
  };
  return { snapshot: { solves: [], extras: [extra] }, nextPage: PAGE_TAGS, resumeCursor: null };
}

async function fetchTags(handle: string): Promise<SyncPage> {
  const data = requireData(await gql<TagCountsData>(Q_TAGS, { username: handle }), "tag counts");
  if (!data.matchedUser) throw unknownUser(handle);
  const counts = data.matchedUser.tagProblemCounts;
  if (!counts) throw new Error("LeetCode tag counts failed: response is missing tagProblemCounts");
  const levels: TagLevel[] = ["fundamental", "intermediate", "advanced"];
  const payload = levels.flatMap((level) =>
    (counts[level] ?? []).map((t) => ({
      tagSlug: t.tagSlug,
      tagName: t.tagName,
      level,
      problemsSolved: t.problemsSolved,
    })),
  );
  return {
    snapshot: { solves: [], extras: [{ kind: "lc_tag_counts", payload }] },
    nextPage: PAGE_RECENT,
    resumeCursor: null,
  };
}

async function fetchRecent(handle: string, cursor: SyncCursor | null): Promise<SyncPage> {
  const data = requireData(
    await gql<RecentAcData>(Q_RECENT, { username: handle, limit: RECENT_AC_LIMIT }),
    "recent submissions",
  );
  const list = data.recentAcSubmissionList;
  if (!list) throw new Error("LeetCode recent submissions failed: response is missing the list");

  // Dedupe by slug keeping the earliest timestamp (re-solves repeat in this list).
  const earliest = new Map<string, { title: string; ts: number }>();
  for (const item of list) {
    const ts = Number(item.timestamp);
    if (!Number.isFinite(ts)) continue;
    const seen = earliest.get(item.titleSlug);
    if (!seen || ts < seen.ts) earliest.set(item.titleSlug, { title: item.title, ts });
  }

  const after = cursor?.platform === "leetcode" ? cursor.lastAcceptedAt : null;
  const solves: NormalizedSolve[] = [];
  let maxTs = -Infinity;
  for (const [slug, { title, ts }] of earliest) {
    if (after !== null && ts <= after) continue;
    maxTs = Math.max(maxTs, ts);
    solves.push({
      platform: "leetcode",
      externalProblemId: slug,
      firstSolvedAt: new Date(ts * 1000),
      problemFallback: { title, url: problemUrl(slug), rawTags: [] },
    });
  }

  return {
    snapshot: { solves, extras: [] },
    nextPage: PAGE_CONTEST,
    resumeCursor: solves.length > 0 ? { platform: "leetcode", lastAcceptedAt: maxTs } : null,
  };
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fetchContestSummary(handle: string): Promise<SyncPage> {
  const data = requireData(
    await gql<ContestRankingData>(Q_CONTEST, { username: handle }),
    "contest ranking",
  );
  // Null for users who never entered a contest (and, quietly, for unknown users).
  const r = data.userContestRanking;
  const payload: LcContestSummary = {
    attended: r ? (numOrNull(r.attendedContestsCount) ?? 0) : 0,
    rating: numOrNull(r?.rating),
    globalRanking: numOrNull(r?.globalRanking),
    totalParticipants: numOrNull(r?.totalParticipants),
    topPercentage: numOrNull(r?.topPercentage),
    badge: r?.badge?.name ? r.badge.name : null,
  };
  return {
    snapshot: { solves: [], extras: [{ kind: "lc_contest", payload }] },
    nextPage: PAGE_CONTEST_HISTORY,
    resumeCursor: null,
  };
}

async function fetchContestHistory(handle: string): Promise<SyncPage> {
  const data = requireData(
    await gql<ContestHistoryData>(Q_CONTEST_HISTORY, { username: handle }),
    "contest history",
  );
  const rows = data.userContestRankingHistory;
  // Null means "unknown", never "no contests": throwing keeps stored rows intact.
  if (!rows) throw new Error("LeetCode contest history failed: response is missing the list");

  const seen = new Set<string>();
  const contests: NormalizedContest[] = [];
  let prevRating: number | null = null;
  for (const row of rows) {
    if (row.attended !== true) continue;
    const slug = row.contest?.titleSlug;
    const title = row.contest?.title;
    const start = numOrNull(row.contest?.startTime);
    const rating = numOrNull(row.rating);
    if (!slug || !title || start === null) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const newRating = rating === null ? null : Math.round(rating);
    const rank = numOrNull(row.ranking);
    contests.push({
      contestKey: slug,
      name: title,
      heldAt: new Date(start * 1000),
      rank: rank !== null && rank > 0 ? rank : null,
      oldRating: prevRating,
      newRating,
      rated: true,
    });
    if (newRating !== null) prevRating = newRating;
  }
  return {
    snapshot: { solves: [], extras: [], contests },
    nextPage: PAGE_BADGES,
    resumeCursor: null,
  };
}

function absoluteIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const url = icon.startsWith("/") && !icon.startsWith("//") ? `${SITE_ORIGIN}${icon}` : icon;
  // https only: the page renders these as <img> sources.
  return /^https:\/\//i.test(url) ? url : null;
}

async function fetchBadges(handle: string): Promise<SyncPage> {
  const data = requireData(await gql<BadgesData>(Q_BADGES, { username: handle }), "badges");
  if (!data.matchedUser) throw unknownUser(handle);
  const payload: LcBadge[] = [];
  for (const b of data.matchedUser.badges ?? []) {
    const icon = absoluteIcon(b.icon);
    if (!icon || b.id === null || b.id === undefined || !b.displayName) continue;
    payload.push({
      id: String(b.id),
      name: b.displayName,
      icon,
      earnedAt:
        b.creationDate && /^\d{4}-\d{2}-\d{2}$/.test(b.creationDate) ? b.creationDate : null,
      category: b.category ? b.category : null,
    });
  }
  return {
    snapshot: { solves: [], extras: [{ kind: "lc_badges", payload }] },
    nextPage: PAGE_CALENDAR,
    resumeCursor: null,
  };
}

/** submissionCalendar is a JSON string of UTC-midnight epoch seconds -> count. */
function parseCalendar(raw: string | null | undefined): { day: string; count: number }[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LeetCode calendar failed: submissionCalendar is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const days: { day: string; count: number }[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    const seconds = Number(key);
    const count = Number(value);
    if (!Number.isFinite(seconds) || !Number.isFinite(count)) continue;
    days.push({ day: new Date(seconds * 1000).toISOString().slice(0, 10), count });
  }
  return days.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

function largestYearBefore(years: number[], limit: number): number | null {
  const earlier = years.filter((y) => y < limit);
  return earlier.length > 0 ? Math.max(...earlier) : null;
}

async function fetchCalendar(
  handle: string,
  cursor: SyncCursor | null,
  year: number | null,
): Promise<SyncPage> {
  const res =
    year === null
      ? await gql<CalendarData>(Q_CALENDAR, { username: handle })
      : await gql<CalendarData>(Q_CALENDAR_YEAR, { username: handle, year });
  const data = requireData(res, "calendar");
  if (!data.matchedUser) throw unknownUser(handle);
  const cal = data.matchedUser.userCalendar;
  if (!cal) throw new Error("LeetCode calendar failed: response is missing userCalendar");

  const activeYears = cal.activeYears ?? [];
  const activity = parseCalendar(cal.submissionCalendar);

  if (year !== null) {
    return {
      snapshot: { solves: [], extras: [], activity },
      nextPage: largestYearBefore(activeYears, year),
      resumeCursor: null,
    };
  }

  const extra: PlatformExtra = {
    kind: "lc_calendar",
    payload: {
      streak: cal.streak ?? 0,
      totalActiveDays: cal.totalActiveDays ?? 0,
      activeYears,
    },
  };
  // Full activity history only on the first sync; incremental syncs just refresh the last year.
  const nextPage =
    cursor === null ? largestYearBefore(activeYears, new Date().getUTCFullYear()) : null;
  return { snapshot: { solves: [], extras: [extra], activity }, nextPage, resumeCursor: null };
}

// ---------------------------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------------------------

async function validateHandle(handle: string): Promise<ValidateResult> {
  try {
    const res = await gql<{ matchedUser?: { username?: string } | null }>(
      Q_VALIDATE,
      { username: handle },
      1,
    );
    const user = res.data?.matchedUser;
    if (user) return { result: "valid", canonicalHandle: user.username ?? handle };
    if (user === null) return { result: "invalid", message: `No LeetCode user named "${handle}".` };
    return { result: "retry", message: `LeetCode did not answer: ${errorMessages(res)}` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const prefix = isRetryableError(err) ? "LeetCode is unavailable" : "Unexpected LeetCode reply";
    return { result: "retry", message: `${prefix}: ${detail}` };
  }
}

async function readVerificationField(handle: string): Promise<string | null> {
  const data = requireData(await gql<ProfileData>(Q_PROFILE, { username: handle }), "profile");
  const aboutMe = data.matchedUser?.profile?.aboutMe?.trim();
  return aboutMe ? aboutMe : null;
}

async function fetchPage(
  handle: string,
  cursor: SyncCursor | null,
  page: PageToken | null,
): Promise<SyncPage> {
  const token = page ?? PAGE_STATS;
  switch (token) {
    case PAGE_STATS:
      return fetchStats(handle);
    case PAGE_TAGS:
      return fetchTags(handle);
    case PAGE_RECENT:
      return fetchRecent(handle, cursor);
    case PAGE_CONTEST:
      return fetchContestSummary(handle);
    case PAGE_CONTEST_HISTORY:
      return fetchContestHistory(handle);
    case PAGE_BADGES:
      return fetchBadges(handle);
    case PAGE_CALENDAR:
      return fetchCalendar(handle, cursor, null);
    default:
      if (Number.isInteger(token) && token >= FIRST_YEAR_TOKEN) {
        return fetchCalendar(handle, cursor, token);
      }
      throw new Error(`Unknown LeetCode page token: ${token}`);
  }
}

export const leetcodeAdapter: PlatformAdapter = {
  platform: "leetcode",
  minDelayMs: MIN_DELAY_MS,
  capabilities: {
    history: "recent_only",
    topicTags: true,
    topicCounts: true,
    activityCalendar: true,
  },
  validateHandle,
  readVerificationField,
  fetchPage,
};

// ---------------------------------------------------------------------------------------------
// Catalog (weekly cron): the whole public question list, including paid-only problems
// ---------------------------------------------------------------------------------------------

async function fetchCatalog(): Promise<CatalogProblem[]> {
  const bySlug = new Map<string, CatalogProblem>();
  let skip = 0;
  for (let pageNo = 0; pageNo < CATALOG_MAX_PAGES; pageNo++) {
    const data = requireData(
      await gql<CatalogData>(Q_CATALOG, { limit: CATALOG_PAGE_SIZE, skip }),
      "catalog",
    );
    const list = data.problemsetQuestionList;
    if (!list?.questions) throw new Error("LeetCode catalog failed: response is missing questions");
    if (list.questions.length === 0) break;
    for (const q of list.questions) {
      bySlug.set(q.titleSlug, {
        platform: "leetcode",
        externalId: q.titleSlug,
        title: q.title,
        url: problemUrl(q.titleSlug),
        difficultyRaw: titleCase(q.difficulty),
        rawTags: (q.topicTags ?? []).map((t) => t.slug),
        paidOnly: q.paidOnly === true,
      });
    }
    skip += list.questions.length;
    if (typeof list.total === "number" && skip >= list.total) break;
  }
  return [...bySlug.values()];
}

export const leetcodeCatalog: CatalogAdapter = {
  platform: "leetcode",
  fetchCatalog,
};
