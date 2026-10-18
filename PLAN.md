# CodeLogs: Project Plan

> Approved 12 Oct 2026. Open choices are listed in §4; progress is tracked in §12.

Status: building (M5 in progress) · Working name: **CodeLogs** (can change later) · Type: side project / portfolio showcase (no deadline) · Last updated: 15 Oct 2026 (M7 social links merged; M6 contests + badges built, PR open)

---

## 1. What we're building
A web app where you link your coding-platform handles. It pulls in the problems you've solved and shows one dashboard: totals, a heatmap, difficulty and topic breakdowns. It also shows **your weak topics and what to solve next**. A public profile page (`/u/<name>`) works as a shareable portfolio.

**Why this one is different:** existing trackers (Codolio, CoderSTAT, CoderHub, Dsabuddy) mostly show totals and ratings. CodeLogs maps every platform's tags onto **one topic list**, scores your weak areas, and recommends **unsolved** problems at your level.

**Codolio, the closest competitor (owner's notes, 14 Oct 2026):** a handle plus a verification step, like ours, gets you solved counts from LeetCode, Code Studio (Code360), GFG, InterviewBit, CodeChef, Codeforces, HackerRank and AtCoder. It also shows contest history, LeetCode badges and difficulty tags. CodeLogs already has difficulty tags. Contests and LC badges for our 3 platforms are planned as M6, now under Later (§7). Social links on the profile are M7, built first. Adding Codolio's other platforms was open question #7; the owner settled the route on 18 Oct 2026 (§4, More platforms).

## 2. Product name ideas (decide later)
| Name | Vibe |
|---|---|
| **CodeLogs** | Current working name; plain and descriptive |
| **SolveSync** | "Sync all your solves" |
| **Topicwise** | Leans on the topic-analysis differentiator |
| **NextSolve** | Leans on the "what to solve next" feature |

## 3. Your accounts (checked 12 Oct 2026)
| Platform | Handle | What the public data shows |
|---|---|---|
| Codeforces | `savinyu` | Rating 839 · 110 submissions · 46 unique accepted. **Full list with tags available** |
| LeetCode | `CptDailyBird` | 319 solved (E81 / M195 / H43) · calendar public (57 active days, 16-day streak). **Counts + last 20 only** |
| AtCoder | `savinyu` | Profile exists, no submissions yet. We'll test the adapter with the public handle `chokudai` |

## 4. Decisions
**Decided**
- **Stack:** Next.js (App Router) + TypeScript as one app, for both UI and API.
- **DB:** Postgres on Neon (free tier), accessed through **Drizzle ORM**.
- **Background sync:** **Inngest**, a serverless step-function queue that calls our Next.js route via webhook. This replaces pg-boss, which needs a long-running worker and can't run on Vercel (see §11). Every page fetch is its own `step.run`, and `step.sleep` handles the rate-limit delays. Free tier is about 50k step runs a month.
- **Catalog sync is separate from user sync:** a daily Inngest cron, `syncCatalogs`, refreshes the global `problems` table (CF `problemset.problems`, AtCoder `problems.json` + `problem-models.json`). The LeetCode catalog refreshes weekly. A user sync only writes that user's solves, stats and activity, and adds a stub problem row if one is missing.
- **Incremental sync:** each account stores a `sync_cursor` (CF: last submission id; AtCoder: last `epoch_second`; LC: last recent-AC timestamp). Later syncs only process newer submissions. Inserts use `ON CONFLICT DO NOTHING`.
- **Auth for CodeLogs itself:** **Better Auth** with **GitHub** login (Drizzle adapter). It replaced Auth.js on 12 Oct 2026: Auth.js v5 never left beta and is now maintained by the Better Auth team. **Google** login added beside it on 18 Oct 2026 (owner request); see PLAN-v2.md §8.
- **Hosting:** Vercel Hobby (functions run up to 300 s with Fluid Compute) + Neon + Inngest Cloud. Locally: the Inngest dev server.
- **Package manager:** pnpm.
- **v1 platforms:** Codeforces (full), AtCoder (full, no tags), LeetCode (public counts and the 20 most recent solves, labelled "partial").
- **LeetCode access:** the server fetches public data **only on demand**: when the user clicks Sync, plus at most once a day. Responses are cached. Never passwords or cookies.
- **First differentiator:** a shared topic list, weak-topic scoring, and "solve next" recommendations.
- **UI kit:** Tailwind 4 + shadcn/ui (`base-nova` style, on Base UI). This was the default for open question #2 and was adopted in M1.
- **Topic list (was open #3, decided 13 Oct 2026):** two levels. About 10 macro topics for the UI, with micro topics underneath for scoring and recommendations. The taxonomy and tag mappings live in code (`lib/topics/`), not in the `topics`/`tag_mappings` tables.
- **Recommendations (was open #4, decided 13 Oct 2026):** for the 3 weakest macro topics, unsolved CF problems rated +100–200 above the user's rating (primary). LC picks exclude known solves and are labelled "may already be solved" unless `history_complete`. Paid-only LC problems are never recommended.
- **Topic visibility (decided 13 Oct 2026):** the topic coverage chart is public on `/u/[username]`. Weak-topic scores and "Solve next" are shown only to the owner.
- **Activity timeline (decided 13 Oct 2026):** the heatmap has a period filter: "Last 12 months" (default) plus one option per year with activity, newest first (`?year=2025`, combines with `?platform=`). A year shows Jan–Dec up to today, with that year's active days, total and longest streak. The current streak shows only when the period includes today. The filter affects the Activity card only.
- **LeetCode backfill:** confirmed by the owner on 12 Oct 2026. Logged in, `leetcode.com/api/problems/all/` marks solved problems `"status": "ac"`, so the user-triggered JSON import (M5) is viable.
- **Later:** Chrome extension for full LeetCode history (built, M8).
- **More platforms (was open #7, decided by the owner 18 Oct 2026):** two layers per platform. First the server fetches **solved counts only**, on demand like LeetCode, from public data; then the extension can send the full solved list from the user's own browser. Each platform gets a terms and robots.txt check before its server part is built (research in `scripts/spike/FINDINGS.md`).
- **Sheets stay off the public profile** (owner, 18 Oct 2026).

**Still open (I'll ask when we reach them)**
| # | Question | My default |
|---|---|---|
| 1 | Chart library | shadcn/ui charts (Recharts inside client components) + a custom SVG heatmap |
| 5 | Public profiles: opt-in or on by default | Opt-in |
| 6 | Final product name | CodeLogs for now |
| 8 | `robots.txt` consistency (found 14 Oct 2026): LeetCode's robots.txt disallows `/graphql`, which our LC adapter already uses (§4 accepted on-demand, user-triggered fetches), and AtCoder's disallows `/users/*/history/`, the only source of AtCoder contest history. §5 cites robots.txt as the reason HackerRank was excluded | LeetCode stays as decided. AtCoder contest history is left out of M6 |
| 9 | Profile bands (idea, 15 Oct 2026, M11): bands by solved count, each with its own public profile background, like CF's rank colors. Thresholds, the background style and whether bands are shown on logged-out profiles are open | Bands count verified solves only, so unverified handles can't move a profile up a band. Thresholds to be proposed once the owner picks the style |

## 5. Platform data facts (re-verified 12 Oct 2026; full detail and design impact in `scripts/spike/FINDINGS.md`)
- **Codeforces (official API):**
  - `user.status?handle=X` with no `count` returns the **whole history in one call** (5,499 rows for tourist).
  - Problem tags and difficulty come from a cached `problemset.problems` (about 11,450 problems).
  - The `rating` field can be missing on new problems.
  - Rate limit: 1 request per 2 seconds.
- **AtCoder (kenkoooo, unofficial):**
  - `v3/user/submissions?user=X&from_second=T` returns pages of 500, so walk forward by `epoch_second`.
  - Difficulty comes from `problem-models.json` and can be negative.
  - No tags.
  - Wait more than 1 second between calls.
- **LeetCode (GraphQL, unofficial):**
  - Public data: difficulty counts, per-tag **counts**, calendar, and the last **20** accepted submissions (capped at 20 even if you ask for more).
  - The full submission list is null without logging in.
  - Send each query separately: one failing field nulls the whole user object.
  - Tags and difficulty for those 20 come from the public problem catalog.
- **Contests and badges (checked 14 Oct 2026; detail in FINDINGS.md):**
  - CF: official `user.rating?handle=X` returns every rated contest in one call (rank, old/new rating, time). `savinyu`: 20 contests.
  - LC: the GraphQL query `userContestRanking` gives the rating, global rank, top %, attended count and contest badge (Knight/Guardian). `userContestRankingHistory` lists every contest, so filter on `attended`. Both are `null` or empty for users who never entered a contest (`CptDailyBird`). `matchedUser.badges` gives badge name, icon and date. Some icon URLs are relative (`/static/…`) and need the `https://leetcode.com` prefix.
  - AtCoder: `atcoder.jp/users/X/history/json` has the data (rated flag, place, old/new rating, performance) but robots.txt disallows it (§4 open #8). kenkoooo has no rating history.
- **Not in v1:**
  - HackerRank: its `/rest` endpoints are disallowed by robots.txt.
  - CodeChef: HTML only, and its terms forbid scraping.
  - GFG: the solved list isn't verified, and its terms forbid bots.

## 6. Architecture
```
Browser ──> Next.js (pages + route handlers) ──────────> Postgres (Neon)
                │  "Sync now"                                ▲
                └─ inngest.send("account/sync") ──┐          │
                                                  ▼          │
Inngest Cloud ── webhook ──> /api/inngest  (Inngest functions, each step = one invocation)
   ├─ syncAccount: step.run(fetch page) → step.run(upsert) → step.sleep(rate limit) → next page…
   ├─ syncStaleAccounts (cron, daily): fan out account/sync events
   └─ syncCatalogs (cron, daily; LC weekly): refresh global problems table
                                                  │
                                   adapters (codeforces | atcoder | leetcode) → platform APIs
```

### Adapter interface (`lib/adapters/types.ts`)
```ts
type PlatformId = "codeforces" | "atcoder" | "leetcode";
type HistoryCompleteness = "full" | "recent_only" | "counts_only";

interface NormalizedSolve {
  platform: PlatformId;
  externalProblemId: string;   // "1850A", "abc138_a", "two-sum"
  firstSolvedAt?: Date;
  problemFallback?: { title; url; difficultyRaw?; rawTags };  // stub row when the catalog misses it
}
interface PlatformSnapshot {
  solves: NormalizedSolve[];
  extras: { kind: string; payload: unknown }[]; // tag counts, calendar, rating
}
interface SyncPage {
  snapshot: PlatformSnapshot;
  nextPage: PageToken | null;      // null = done; otherwise Inngest runs another step
  resumeCursor: SyncCursor | null; // persisted only after every page succeeds
}
interface PlatformAdapter {
  platform: PlatformId;
  capabilities: { history: HistoryCompleteness; topicTags: boolean;
                  topicCounts: boolean; activityCalendar: boolean };
  minDelayMs: number;                                   // CF 2000, AtCoder 1100, LC 1000
  validateHandle(handle: string): Promise<{ result: "valid" | "invalid" | "retry";
                                            canonicalHandle?: string; message?: string }>;
  readVerificationField(handle: string): Promise<string | null>; // CF org, AtCoder affiliation, LC summary
  fetchPage(handle: string, cursor: SyncCursor | null, page: PageToken | null): Promise<SyncPage>;
}
interface CatalogAdapter {
  fetchCatalog(): Promise<CatalogProblem[]>;            // used only by syncCatalogs
}
```
The full, current contract is in `lib/adapters/types.ts`. Adapters are **pure**: they make HTTP calls and normalize the results. They never touch the DB, so the fixture tests need no database.

### Data model (Drizzle)
```
users              (id, github_id, name, username, public_profile bool, created_at)
platform_accounts  (id, user_id, platform, handle, verified bool, verify_token,
                    status ok|partial|error|syncing, sync_cursor jsonb,
                    history_complete bool, last_synced_at)   unique(user_id, platform)
problems           (id, platform, external_id, title, url, difficulty_raw,
                    difficulty_norm 1-5, raw_tags jsonb, paid_only bool, catalog_updated_at)
                                                               unique(platform, external_id)
catalog_syncs      (id, platform, started_at, finished_at, status, rows)
solves             (id, user_id, problem_id, first_solved_at, source api|extension)
                                                               unique(user_id, problem_id)
raw_payloads       (id, account_id, kind, fetched_at, payload jsonb)
activity_days      (user_id, platform, day, count)             unique(user_id, platform, day)
platform_stats     (account_id, kind, payload jsonb, fetched_at)  -- LC counts, CF rating
sync_runs          (id, account_id, started_at, finished_at, status, error, items)
topics             (id, slug, name, parent_id)                 unused: the taxonomy lives in lib/topics
tag_mappings       (platform, raw_tag, topic_id)               unused: mappings live in lib/topics/mappings
```

### Repo layout
```
CodeLogs/
  PLAN.md  README.md
  app/                      (auth)/, dashboard/, u/[username]/, api/
  components/               charts, heatmap, cards
  lib/adapters/             types.ts, codeforces.ts, atcoder.ts, leetcode.ts, http.ts (rate limit + retry)
  lib/inngest/              client.ts, functions/{syncAccount,syncStaleAccounts,syncCatalogs}.ts
  lib/sync/                 upsert.ts, cursor.ts
  lib/db/                   schema.ts, client.ts, migrations/
  lib/topics/               taxonomy.ts, mappings/{codeforces,leetcode,index}.ts, scoring.ts, recommend.ts
  scripts/spike/            cf.ts, atcoder.ts, leetcode.ts → fixtures/ + FINDINGS.md
  fixtures/                 saved API responses (tests)
  tests/                    adapter contract tests, upsert idempotency tests
  .github/workflows/ci.yml
```

### Extra features beyond Cursor's plan
- **Handle verification:** the user pastes a short token into their CF "organization" field, AtCoder "affiliation" field, or LeetCode "summary". We check it once. Only verified handles show on public profiles.
- **LeetCode backfill (if M0 confirms it works):** the user, logged in on leetcode.com in their own browser, saves their solved-problems JSON and uploads it to CodeLogs. The cookie never leaves their browser. After that, the 20 recent solves keep them up to date as long as they sync at least once every 20 solves. The account is marked `history_complete`.
- **Public profile** `/u/[username]` with an OG preview image.
- **Honest data labels:** a "partial" badge on LeetCode, and "no tags" on AtCoder.
- **CI:** lint, typecheck and tests on every push.

## 7. Milestones & task list
Legend: 🧭 = Captain (Opus 5.5) does it: architecture, interfaces, schema, review, integration. 🤖 = handed to a **Sonnet 5.5 subagent** with a precise spec. Tasks marked ∥ can run in parallel.

### M0: Spike (verify data with your handles)
- 🤖∥ `scripts/spike/cf.ts`: fetch `user.info`, `user.status`, `problemset.problems` for `savinyu` → fixtures
- 🤖∥ `scripts/spike/atcoder.ts`: `chokudai` paging across `from_second`, plus the problems and models JSON → fixtures (check for duplicates at page boundaries)
- 🤖∥ `scripts/spike/leetcode.ts`: 4 separate queries for `CptDailyBird` + a catalog lookup for the recent 20 + one catalog page (to size the weekly catalog sync) → fixtures
- 👤 **You:** while logged in to leetcode.com, open `https://leetcode.com/api/problems/all/` and check whether solved problems show `"status": "ac"`. If they do, save the file to `fixtures/leetcode/me-problems-all.json`. This decides the backfill design (§4 #7).
- 🧭 Write `FINDINGS.md` from the outputs; adjust the adapter interface if needed
- **Done when:** fixtures are saved and the findings are written.

### M1: Foundation
- 🧭 Scaffold Next.js + TS + Tailwind + ESLint/Prettier (pnpm)
- 🧭 `lib/adapters/types.ts`, `lib/db/schema.ts`, first migration
- 🤖 Better Auth GitHub login + `users` row creation
- 🤖 "Connect platforms" page: add or remove a handle, with a `validateHandle` stub
- 🤖 CI workflow (lint, typecheck, vitest)
- **Done when:** you can log in, add your 3 handles, and the rows persist.

### M2: Adapters + sync
- 🤖∥ Codeforces adapter + catalog adapter + fixture tests
- 🤖∥ AtCoder adapter + catalog adapter + fixture tests
- 🤖∥ LeetCode adapter (separate queries, `recent_only`) + catalog adapter + fixture tests
- 🧭 `lib/adapters/http.ts`: fetch wrapper with timeout, retry/backoff on 429/5xx and CF `Call limit exceeded`
- 🧭 `lib/sync/upsert.ts` + `cursor.ts`: cursor-based incremental writes, `ON CONFLICT DO NOTHING`
- 🤖 Inngest client + `syncAccount` (one step per page, `step.sleep(minDelayMs)`, per-platform concurrency limit 1) + `syncCatalogs` cron + "Sync now" button + status UI + `sync_runs` logging
- **Done when:** syncing your accounts fills the tables; a second sync writes about 0 rows; one adapter failing leaves the others `ok`; `chokudai` on AtCoder (many pages) completes without a timeout.

### M3: Dashboard + public profile
- 🤖 Dark theme: `next-themes` provider (class strategy, follows the system by default) + a theme toggle in the header, just left of the user avatar. Charts and the heatmap use theme tokens so they work in both modes
- 🧭 Dashboard data queries (aggregations)
- 🤖∥ Totals cards + per-platform filter (LC labelled as a count)
- 🤖∥ Heatmap from activity_days + solve timestamps
- 🤖∥ Difficulty split + raw-tag topic chart (AtCoder shows an empty state)
- 🤖∥ Recent solves list
- 🤖 `/u/[username]` public page + OG image
- **Done when:** one page answers how many problems, on which platforms, which recent ones, and which topics, including the gaps.

### M4: Differentiator: topics and "solve next"
- 🧭 Design `taxonomy.json` (10 macro topics → about 30 micro topics) and the scoring formula
- 🤖∥ CF tag → micro-topic mapping file; LC tag → micro-topic mapping file (from fixtures)
- 🧭 `scoring.ts`: LeetCode coverage comes from the **lifetime tag counts**, never from the 20 recent solves, so recent activity can't make a topic look weak. CF coverage comes from per-problem tags, weighted by rating relative to the user's rating.
- 🤖 `recommend.ts`: unsolved CF problems near rating +100–200 for the 3 weakest topics. LC recommendations exclude known solves and are labelled "may already be solved" unless `history_complete`.
- 🤖 "Weak topics" and "Solve next" UI
- 🤖 Activity timeline filter: "Last 12 months" + one option per year with activity (§4)
- **Done when:** a CF `dp` solve and LeetCode's DP count show under one "Dynamic Programming" topic, recommendations exclude problems you've already solved, and the heatmap can show any year you were active.

### M5: Ship
- 🤖 Handle verification flow (CF organization, AtCoder affiliation, LC summary). Then hide unverified handles on `/u/[username]` (M3 shows every connected handle)
- 🤖 LeetCode backfill upload (if M0 confirmed it)
- 🤖 `syncStaleAccounts` daily Inngest cron
- 🤖 Account export and delete
- 🧭 README: problem, architecture diagram, screenshots, data limits
- 🧭 Deploy to Vercel + Neon; seed your profile; final review
- **Done when:** your live `/u/<you>` link works logged out and friends can sign up.

### M7: Social links on the profile (added 14 Oct 2026; built 15 Oct 2026, ahead of M6)
- 🧭 Schema: `social_links` (user_id, kind, value), primary key (user_id, kind). Kinds: `x`, `instagram`, `website`, `email`. GitHub isn't stored: it's the login (`users.username`), always shown, and the only verified link. X and Instagram store a **handle** (a pasted profile URL is reduced to it) and we build the URL, so a profile can't carry an arbitrary link under a brand icon. `website` must be `https://`; `email` becomes a `mailto:` link
- 🧭 `lib/social-links-shared.ts` (pure, tested): per-kind parsing, URLs and labels. Settings has a "Social links" card with one field per kind; saving replaces the set atomically (`db.batch`), an empty field removes that link, and the server action re-checks `getCurrentUser()`
- 🧭 Icon row (`components/social-links.tsx`) beside the name on `/u/[username]` and under the dashboard greeting, with `rel="me nofollow noopener noreferrer"` and `target="_blank"`. Included in the JSON export; account delete cascades to it
- **Done when:** the owner adds X, Instagram, a website and an email, and they show logged out on `/u/savinyu`; a `javascript:` or `http://` website and a malformed handle are rejected.

### Later
#### M6: Contests + LeetCode badges (added 14 Oct 2026, from the Codolio comparison; moved to Later on 15 Oct 2026; built 15 Oct 2026, see §12)
- 🧭 Schema: `contest_results` (account_id, contest_key, name, started_at, rank, old_rating, new_rating, rated bool), unique(account_id, contest_key). LC badges and the LC contest summary go in `platform_stats` (kinds `lc_badges` and `lc_contest`), so they need no new table. Extend `PlatformSnapshot.extras` or add `fetchContests(handle)` to the adapter contract
- 🤖∥ CF: `user.rating`, one call per sync, replacing the stored rows (the list is small and append-only) + fixture test
- 🤖∥ LC: `userContestRanking` + `userContestRankingHistory` (attended only) + `matchedUser.badges`, each sent as its own query (§5) + fixture tests, with no-contest users covered
- 🤖 UI: a Contests card with a rating-over-time line per platform, contests entered, best rank, current and max rating, plus the LC contest badge. A LeetCode badges strip with the icons (plain `<img>`, or `next/image` with `remotePatterns` for `assets.leetcode.com` and `leetcode.com`). Public on `/u/[username]` for verified handles
- AtCoder: skipped while robots.txt disallows `/users/*/history/` (§4 open #8). The card says "AtCoder contests not available"
- **Done when:** CF shows `savinyu`'s 20 contests with rating 839 as the last point; `lee215` on LC shows 27 contests and the Guardian badge; `CptDailyBird` shows its LC badges and an empty contest state; a second sync changes nothing.

- M8: Chrome MV3 extension for full LeetCode history (sends accepts to our API with our token). Built 15 Oct 2026 (branch `m8-extension`, see §12):
  - 🧭 `api_tokens` (hash only, prefix for display, last used; max 5 per user), Bearer auth, `GET /api/extension/me` + `POST /api/extension/leetcode` (`{ userName, solves: [{ slug, solvedAt | null }] }`), shared `lib/leetcode-ingest.ts` with the JSON import (same handle check, same `history_complete` rule; extension solves count like imports)
  - 🤖 Settings "Browser extension" card (create once-visible tokens, list, revoke); 🤖 `extension/`: reads `leetcode.com/api/problems/all/` (+ optionally `api/submissions/` for dates) in the user's browser and posts slugs + dates. Never sends cookies or code
- M9: Sheet tracking (Blind 75 / NeetCode 150 / Striver). Built 15 Oct 2026 for Blind 75 and NeetCode 150 (branch `m9-sheets`, see §12). Striver is left out: takeuforward publishes no openly licensed problem list, and its sheets mix LeetCode with GFG / Coding Ninjas links (owner to decide)
- M10: more platforms by the §4 route (server counts first, then the extension for full lists), plus revision reminders
- M11: Profile bands (idea, added 15 Oct 2026; not started, see §4 open #9). A band comes from the number of verified solves across platforms, and each band sets the background of `/u/[username]` and its OG image:
  - 🧭 Band rule in pure code (`lib/profile-band.ts`, tested): thresholds as one table, computed from the same verified totals the public page already shows. No new table unless the owner wants a band history
  - 🧭 Backgrounds use theme tokens (`--band-*`, light and dark), never hex (CLAUDE.md). Each band needs a legible name and text colour
  - 🤖 Apply the band on `/u/[username]` (background + band name) and in the OG image; the owner's dashboard shows their band and what the next one needs
  - **Done when:** the owner's public page shows the band for the verified solve count, the band changes when a threshold is crossed, and an unverified handle doesn't change it

## 8. How the captain/subagent split works
- **Before each milestone:** the Captain (Opus) writes a todo list. Each 🤖 task gets a spec: files to create, interfaces to import, the fixture to test against, and the "done when" check.
- **Delegated tasks:** spawned with `model: "sonnet"`. Independent ones (∥) run in parallel. Tasks that touch the same files run one after another.
- **After each batch:** the Captain reviews the diffs, runs typecheck and tests, integrates, and updates PLAN.md.
- **Choices:** whenever a choice isn't settled in §4, the Captain asks you before proceeding.

## 9. Verification (whole project)
- `pnpm test`: each adapter parses its fixtures. Breaking one fixture fails only that adapter.
- Syncing twice gives the same `solves` count; a forced error in one adapter leaves the others `ok`.
- Dashboard CF total = 46-ish unique ACs (matches your CF profile). LC total = 319 (matches your LeetCode profile).
- The `/u/<you>` page loads logged out; Lighthouse is decent on mobile.
- CI is green on the main branch.

## 10. Risks
| Risk | Response |
|---|---|
| LeetCode changes its GraphQL schema | Adapter isolation, fixture tests, extension later |
| Codeforces/kenkoooo rate limiting | Per-platform limiter, cached catalogs, raw payloads kept |
| Vercel function timeouts during long syncs | One Inngest step per page, so no single invocation runs long |
| Inngest free-tier limit (~50k step runs/month) | Incremental cursors keep steps per sync small; catalog sync runs once a day |
| Neon free-tier limits | Incremental writes, trimmed raw payloads, catalog written once a day rather than per user |
| Scope creep | Ship M5 before starting M6+ |
| Chasing Codolio's platform count | Compete on topics and "solve next" (§1). Add platforms only by the §4 "More platforms" route, each after a terms and robots.txt check |

## 11. External review log
### Gemini critique (12 Oct 2026): cross-checked
| Gemini's claim | Verdict | Action |
|---|---|---|
| pg-boss needs a long-running worker; it can't run on Vercel | ✅ Correct | Switched to **Inngest** |
| Vercel Hobby kills functions at 10 s | ❌ Outdated. The official docs give 300 s default and max on Hobby with Fluid Compute | Still adopted one step per page, as a cleaner design |
| Re-upserting 5k rows every sync burns Neon compute | ⚠️ Overstated (your CF has 110 submissions), but the point is fair | Per-account `sync_cursor` + `DO NOTHING`. Not `MAX(first_solved_at)`, which misses re-solves and same-second submissions |
| 20 recent LC solves make the weak-topic scoring wrong | ⚠️ Partly. The plan already scores LC from **lifetime tag counts**. The real gap Gemini missed: LC recommendations can't exclude solves we don't know about | LC recommendations labelled until backfill; CF is the primary recommendation source |
| LeetCode offers a native CSV export | ❌ Not found. No official LC export exists that we could confirm | Replaced with a user-triggered JSON backfill from the user's own browser (verify in M0) |
| AtCoder verification missing | ✅ Correct | Use the AtCoder "affiliation" field |
| Problem catalogs go stale or race inside user syncs | ✅ Correct | Separate `syncCatalogs` cron; user syncs only write stub problem rows |
| Recharts causes hydration errors | ⚠️ Overstated. It's fine inside a `"use client"` component; Tremor and shadcn charts both use Recharts underneath | shadcn/ui charts + custom SVG heatmap |
| 30 topics is too many for a chart | ✅ Fair | 10 macro topics for display, ~30 micro topics underneath |
| "Next.js strongly prefers pnpm" | ❌ Not true, but pnpm is fine | Keep pnpm |

## 12. Progress
- [x] Plan approved (12 Oct 2026); Gemini critique merged
- [x] M0 spike: scripts + fixtures done; see `scripts/spike/FINDINGS.md`. Key surprises:
  - CF catalog misses some problems, so the join needs a fallback
  - AtCoder pages overlap at the boundary, and kenkoooo can't validate handles
  - the LC calendar is a rolling year, and the LC catalog page size is capped at 100
- [x] 👤 LeetCode backfill check: `"status": "ac"` present when logged in (12 Oct 2026)
- [x] M1 foundation (branch `m1-foundation`, PR #1, merged)
  - [x] Next.js 16.4 + Tailwind 4 + shadcn/ui + ESLint/Prettier scaffold
  - [x] `lib/adapters/types.ts`, `lib/db/schema.ts`, migration `0000_init` applied to Neon
  - [x] Better Auth server config (GitHub), `lib/session.ts`
  - [x] Sign-in UI + app shell, Connect platforms page (format-only `validateHandleStub`), CI + Vitest (36 tests)
  - [x] Verified: build passes; signed-out redirects work; GitHub authorize URL uses the registered callback; add/list/remove persist in Neon and cascade on delete
  - [x] 👤 Owner: real GitHub login in the browser, add the 3 handles (13 Oct 2026)
- [x] M2 adapters + sync (branch `m2-adapters-sync`, PR #2, merged)
  - [x] `lib/adapters/http.ts` (timeout, retry/backoff on 429/5xx/network + CF call limit, per-host pacing); CF, AtCoder, LC adapters + catalog adapters with fixture tests
  - [x] Connect form validates handles against the platform (`lib/adapters/validate.ts`)
  - [x] `lib/sync/`: difficulty bands (1–5), cursors, idempotent upserts, run bookkeeping, atomic claim with a 5-min "Sync now" cooldown; migration `0001` (`sync_requested_at`)
  - [x] Inngest: `syncAccount` (fetch + write in one step per page, `step.sleep(minDelayMs)`), `syncCatalog` + daily `syncCatalogs` cron (LC Sundays only); both share an env-scoped per-platform concurrency limit of 1
  - [x] Connect page: Sync now / Sync all, last-synced time, errors, auto-refresh while syncing; a new handle syncs right away
  - [x] Verified live (test user, then deleted): catalogs CF 11,450 / AtCoder 9,752 / LC 4,081 rows; first sync CF 46, AtCoder `chokudai` 893 (5 pages, 23 s), LC 17 recent + 174 activity days (`partial`); second sync wrote 0 rows (row `xmin` unchanged); a missing CF handle fails in 1 s without retries while AtCoder and LC stay `ok`; a catalog sync and an account sync on one platform ran one after the other
  - [x] 👤 Owner: ran `pnpm dev` + `pnpm inngest:dev`, connected the 3 handles; first syncs landed (CF 46, LC 17 recent `partial`, AtCoder 0) (13 Oct 2026)
  - [x] Fix: "Sync all" said "Unknown platform". With no `platform` field, `FormData.get` returns `null`, which `z.enum().optional()` rejects
  - Known limits: Inngest concurrency counts running steps, so two accounts on one platform can interleave requests across serverless instances (in-process pacing covers one instance; CF's call limit is retried). AtCoder AHC `_b` problems aren't in kenkoooo's catalog and stay as stubs. Solves keep the first time seen (`DO NOTHING`); the M5 backfill may need "keep the earliest" instead (§4 decision, ask first).
- [x] M3 dashboard + public profile (branch `m3-dashboard`, PR #3, merged)
  - [x] Dark theme (`next-themes`, follows the system) + Light/Dark/System toggle left of the avatar
  - [x] `lib/dashboard/`: view-model types, pure aggregation + platform filter (tested), user-scoped queries; catalog tag counts cached with `"use cache"` + `cacheLife("days")`
  - [x] Theme tokens: one color per platform (`--platform-*`) and a heatmap ramp (`--heat-0..4`), light and dark
  - [x] Sections (Sonnet subagents, in parallel): totals + `?platform=` filter + recent solves; heatmap (pure grid/streaks, tested); difficulty bands + raw-tag charts with "gaps" (popular catalog tags you haven't solved)
  - [x] LeetCode numbers come from its own lifetime counts (total 319, E/M/H split, tag counts), labelled "count"; CF/AtCoder from solve rows. Recent solves keep the newest 15 per platform, so a platform filter still has a list
  - [x] `/u/[username]`: opt-in (switch on the dashboard), read-only, same view; OG image via `opengraph-image.tsx`
  - [x] Fix: usernames were never saved (Better Auth drops `input: false` fields from `mapProfileToUser`). Now set from the GitHub API in an account-create hook; `scripts/dev/backfill-usernames.ts` filled the owner's (`savinyu`)
  - [x] Fix: Geist never applied (`--font-sans` inside `@theme inline` isn't emitted as a variable)
  - [x] Verified against the owner's data (headless Chrome, light/dark/narrow): totals CF 46 (rating 839, max 1062) / AtCoder 0 / LC 319; 57 active days (matches LeetCode); CF tags with gaps `dp`, data structures, dfs; CF filter lists the 2023 CF solves; build passes; 182 tests
  - [x] 👤 Owner: checked and merged (13 Oct 2026)
  - Known limits: an unknown or private `/u/<name>` streams a "not found" page with HTTP 200 (the status is sent before the lookup finishes). Recharts' bar animation never started in headless Chrome, so it's off. Public profiles show unverified handles until M5. Activity mixes units: CF/AtCoder count new solves per day, LC counts submissions (tooltips say which)
- [x] M4 topics + "solve next" + activity timeline (branch `m4-topics`, PR #4, merged; follow-ups PR #5 and PR #6)
  - [x] Taxonomy (`lib/topics/taxonomy.ts`): 10 macro topics, 40 micro topics underneath
  - [x] Activity data covers all years; heatmap period filter: "Last 12 months" + one option per active year (`?year=`, keeps `?platform=`), year grid/stats, current streak only when the period includes today (Sonnet)
  - [x] Tag → topic mappings: CF 38 tags, LC ~190 (every catalog tag listed, generic ones like `array` map to nothing) + coverage tests (Sonnet)
  - [x] `problems.paid_only` (migration `0002`), written by the LC catalog sync; refreshed once by hand (785 of 4,081 paid)
  - [x] `scoring.ts`: coverage = (solved + 2) / (expected + 2), expected = your solves × the topic's share of the catalog. CF solves weighted by rating against your level (0.25–1.25), CF catalog limited to rated ≤ level + 300. LC uses lifetime tag counts, scaled by the catalog's tag overlap, on only the 47 tags LeetCode counts per user. Weak = coverage < 0.8 with ≥ 2 expected; focus = the micro topic furthest behind
  - [x] `recommend.ts`: per weak topic 3 CF (rated +100–200 first, focus tags next, seeded daily shuffle) + 2 LC (free, Medium; Easy under 50 solves; "may already be solved" unless `history_complete`); excludes solves and CF `*special`
  - [x] UI: Topics chart (public; expected values only for the owner), Solve next (owner only, streamed in `<Suspense>`), raw tags renamed "Platform tags" (Sonnet)
  - [x] Verified against the owner's data: CF `dp` + LC `dynamic-programming` both under Dynamic Programming; weak topics Math / Greedy & Sorting / Strings (all), DP (CF only, 0 of ~2 expected at 839); picks contain 0 solved problems; queries ~150 ms; public page in headless Chrome (wide, 2023 + CF, 360px)
  - [x] Owner feedback: activity period is a dropdown (Last 12 months / All time `?year=all` / each year; multi-year grids label January with the year); Solve next topics collapse (`<details>`, open by default); difficulty tags colored Easy green / Medium amber / Hard red (LC labels; CF ≤ 1100 / 1200–1600 / ≥ 1700)
  - [x] Difficulty bands re-cut so each sits inside one tag tier (CF 1200/1400/1700/2100, AtCoder 400/600/900/1300; LC unchanged) and renamed "Band 1–5" (tier + ranges in the tooltip); migration `0003` re-banded stored rows (25,295 checked, 0 mismatches)
  - [x] 👤 Owner: checked Solve next, the period dropdown and the tag colors (13 Oct 2026)
  - [x] AtCoder difficulty tags colored too (< 400 / 400–899 / ≥ 900, matching the bands). The badge shows the AtCoder Problems value: model values under 400, often negative, are squashed into (0, 400) (PR #6)
  - Known limits: LC topic counts are estimates (tag counts overlap; LC only counts 47 tags per user, so micro topics like prefix sums or number theory get no LC signal). Expectations assume the catalog's mix is the right mix. The `topics`/`tag_mappings` tables stay empty. The dev server served a stale `globals.css` again (theme tokens missing) until the file was edited and restored
- [ ] M5 ship (branch `m5-ship`)
  - [x] Handle verification (Sonnet): Connect card shows a `codelogs-xxxxxx` code to paste into the CF organization / AtCoder affiliation / LC summary, then "Check" reads the field (case-insensitive substring). The code is kept until it matches, then cleared. `lib/verification.ts` (pure, tested), `app/connect/verify-actions.ts`
  - [x] `/u/[username]` and its OG image only show verified handles: `getDashboardData(userId, { verifiedOnly: true })` filters every query (solves by account, the rest through `platform_accounts.verified`). The owner's toggle says how many handles it hides
  - [x] LeetCode backfill (Sonnet): the browser parses the saved `api/problems/all/` JSON and sends only `{ userName, slugs }` (the file is ~1.5 MB; server actions cap at 1 MB). The server checks the file's `user_name` matches the connected handle, then inserts `source = 'import'` solves with no date (`DO NOTHING` keeps dated API rows). `history_complete` = has an import AND known solves ≥ LeetCode's lifetime count; recomputed after every LC sync, so a gap of more than 20 solves flips it back to `partial`
  - [x] `syncStaleAccounts` cron (Sonnet), 04:00 UTC: claims accounts not synced or requested for 20 h whose user had a session in the last 30 days or has a public profile, then fans out `account/sync` events
  - [x] Settings page (Sonnet): JSON export (`/api/export`: profile, handles, solves, activity, stats; no tokens, sessions, verify codes, cursors or raw payloads) and account delete (type your username; everything cascades from `users.id`). Linked from the user menu
  - [x] README: problem, features, architecture diagram, data limits, local setup
  - [x] Verified: typecheck, lint, format, 243 tests, `pnpm build`; logged-out `/u/savinyu` shows "No verified platforms yet"; verification fields read live (CF `savinyu` "IIT Rookee", AtCoder `chokudai` "AtCoder Inc. CEO", LC `CptDailyBird` empty); the completeness SQL run read-only on the owner's accounts (LC 17 known of 319, no import → partial); Inngest sees 4 functions
  - [x] 👤 Owner checked: handle verification on all 3 platforms, LeetCode import, export download (13 Oct 2026)
  - [x] Smoother LeetCode import: **Paste** button (clipboard), Cmd/Ctrl+V or drag-and-drop onto the import box, and the file picker also takes the `.html` page Chrome saves with Cmd/Ctrl+S. `parseLeetcodeImportText` in `lib/leetcode-import.ts` tries raw JSON, then each `<pre>` (entities decoded), then a `{…}` slice (drops Chrome's "Pretty-print" label). Checked on the owner's real file as raw JSON, Chrome-rendered HTML and pasted text: 319 slugs each
  - [x] 👤 Owner: tried Paste and the saved `.html` in the browser
  - [x] README screenshots (once the public page has verified data)
  - [ ] 🧭 Deploy to Vercel + Neon + Inngest Cloud (needs the owner's accounts, a production GitHub OAuth app and env vars); seed the owner's profile; final review
  - [x] Dashboard polish (branch `dashboard-polish`, Sonnet ×3 in parallel): Recent solves scrolls inside a capped height so it matches Difficulty; LeetCode copy says "Full history imported: N problems" once `history_complete` (new `PlatformTotal.listed`) and drops the "20 most recent" note; Solve next falls back to the 3 lowest-coverage topics when none is weak (`practiceTopics`, `WeakTopic.weak`); new Active days card (`activeDaysSummary`: active days / period %, streaks, busiest weekday) left of Activity at `lg`, heatmap cells 11 → 10 px so a year fits beside it
  - [ ] 👤 Owner: check the dashboard layout at wide and narrow widths
  - [x] Streak flame (15 Oct 2026): the Active days card shows the current streak LeetCode-style, as a flame icon with the number beside it in the card header, instead of a "Current streak" row. The flame is orange (`--streak` token) once today (UTC) has activity and grey while the streak still waits on today; hover says which. Hidden when the period doesn't include today (past years), like before. `StreakFlame` in `components/dashboard/active-days.tsx`
  - Known limits: imported LC solves have no dates, so they don't show on the heatmap or in recent solves. LC slugs missing from the catalog get a stub problem row built from the slug (title and URL only, no difficulty or tags), so no solve is dropped; the weekly catalog sync then fills them in. The picker stays open while the account is still `partial`. The stale cron only covers users active in the last 30 days or with a public profile
- [ ] M8 browser extension for full LeetCode history (branch `m8-extension`, stacked on `m6-contests`)
  - [x] `api_tokens` (migration `0006`, applied to Neon): SHA-256 hash only, `cl_…` tokens shown once, max 5 per user, revoke = delete, `last_used_at` written at most once a minute. Pure helpers in `lib/api-tokens-shared.ts` (tested)
  - [x] `GET /api/extension/me`, `POST /api/extension/leetcode` (Bearer only, never cookies; 1 MB cap; zod-checked). `lib/leetcode-ingest.ts` is shared with the Connect page import
  - [x] Solves: an undated solve (from an import) now takes the first date seen, from the extension or a later LC sync (`ON CONFLICT … DO UPDATE … WHERE first_solved_at IS NULL`); dated rows never change, so a repeat sync still writes nothing. Owner: this refines the §4 "DO NOTHING" rule; revert if unwanted
  - [x] Settings "Browser extension" card (Sonnet); `extension/` MV3, plain JS, no build (Sonnet)
  - [x] Verified live against the dev server with a temp user (then deleted): 401 without / with a bad or revoked token, 409 for another LeetCode login, 400 for bad JSON; undated upload → 4 solves, history complete; repeat → 0 written; dated upload → 4 dates filled; repeat → 0
  - [x] Settings checked with a temp signed-in user in headless Chrome (CDP): create → token shown once, list, revoke; no overflow at 360 px from the new card
  - [x] 👤 Owner: loaded `extension/` unpacked and synced while logged in to leetcode.com; it works (18 Oct 2026)
  - Known limits: the extension is load-unpacked only (no Web Store listing) and its host permission covers `http://localhost:3000` plus any https origin you approve. Found while testing: the signed-in site header is 8 px wider than a 360 px screen (the avatar), on every page; not fixed here
- [ ] M9 sheets (branch `m9-sheets`, stacked on `m8-extension`)
  - [x] Data: NeetCode's public problem list (`neetcode-gh/leetcode`, MIT; license kept in `lib/sheets/NEETCODE_LICENSE`), generated into `lib/sheets/neetcode-data.ts` by `pnpm sheets:neetcode` (dev only; never fetched at runtime). 150 problems in 18 sections, 75 flagged Blind 75; all 150 slugs exist in our LC catalog and its 7 premium flags match ours
  - [x] `lib/sheets/` (pure, tested): sheet definitions, progress per sheet / section / difficulty; `getLeetcodeSolvedSlugs` counts every LC solve source
  - [x] UI (Sonnet): `/sheets?sheet=` page (owner only), a Sheets card on the dashboard (all / LeetCode filter), "Sheets" in the user menu (not the header: it must fit in 360 px). Honest note while LC history isn't complete
  - [x] Verified: typecheck, lint, format, 336 tests; headless Chrome with a temp signed-in user synced to LC `CptDailyBird` (then deleted): `/sheets` shows 7 / 150 (Blind 75: 4 / 75) with the 20-recent-solves note, dashboard card, nothing in `main` wider than 360 px
  - [x] 👤 Owner: sheet progress stays off the public profile; Striver's 180 added in v2 (PLAN-v2.md §1, 18 Oct 2026)
- [ ] M7 social links (branch `m7-socials`; M6 contests + badges moved to Later on 15 Oct 2026)
  - [x] `social_links` table (migration `0004`, applied to Neon); GitHub comes from the login and isn't stored
  - [x] `lib/social-links-shared.ts`: X and Instagram handles (bare, `@handle` or a pasted profile URL), `https://` websites (a bare domain gets `https://`), plain emails; 9 tests
  - [x] Settings "Social links" card (one field per kind, atomic replace); icon row on `/u/[username]` and the dashboard (with an "Add social links" / "Edit links" link); links in the JSON export
  - [x] Verified: typecheck, lint, format, 279 tests; live with a temp public user (then deleted): a second save replaced the first set, `/u/<name>` rendered every href with `rel="me nofollow noopener noreferrer"`, delete cascaded; headless Chrome screenshot of the icons
  - [ ] 👤 Owner: add links in Settings, check them on the dashboard and logged out on `/u/savinyu`
- [ ] M6 contests + LeetCode badges (branch `m6-contests`)
  - [x] `contest_results` (account_id, contest_key, name, held_at, rank, old/new rating, rated), PK (account_id, contest_key); migration `0005`, applied to Neon. `held_at` replaces the planned `started_at`: CF's `user.rating` only gives the rating update time (the contest's end), LC gives the start
  - [x] Contract: `PlatformSnapshot.contests?` is the account's complete list. When present (even empty) `applySnapshot` replaces the stored set in one `db.batch` (delete keys no longer listed + change-only upsert); undefined leaves it alone. `LcContestSummary` (`lc_contest`) and `LcBadge[]` (`lc_badges`) live in `platform_stats`
  - [x] CF adapter (Sonnet): page 0 = `user.rating` on every sync (user.info → rating → status). LC adapter (Sonnet): pages 4 `userContestRanking` → 5 `userContestRankingHistory` (attended only; ratings rounded; old rating = the previous attended contest's, null for the first; a null list throws so a glitch never wipes rows) → 6 `matchedUser.badges` (relative icons get `https://leetcode.com`; non-https icons dropped) → 3 calendar. Fixtures from live calls (savinyu, lee215, CptDailyBird)
  - [x] Dashboard: `contests` + `leetcodeBadges` in the view model (pure, tested), narrowed by `?platform=`; public pages only show verified handles' contests and badges (same `accountsFilter`). UI (Sonnet): Contests card (one rating line per platform, stat block per platform, newest 5 contests, AtCoder robots.txt footnote) and a LeetCode badges strip (plain `<img>`, no optimizer). Contests in the JSON export
  - [x] Verified: typecheck, lint, format, 309 tests; live with temp users (then deleted): CF `savinyu` 20 contests, last CodeTON Round 5 at 839; LC `lee215` 27 contests, Guardian, top 0.9 %; a second sync left every contest row's `xmin` unchanged; `CptDailyBird` shows "No rated contests yet" and 4 badges; headless Chrome at 1280 px and inside a 360 px frame
  - [ ] 👤 Owner: check the Contests card and badges on the dashboard (Sync now first so CF and LC fetch contests)
