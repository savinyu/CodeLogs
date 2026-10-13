# CodeLogs: Project Plan

> Approved 12 Oct 2026. Open choices are listed in §4; progress is tracked in §12.

Status: building (M3 next) · Working name: **CodeLogs** (can change later) · Type: side project / portfolio showcase (no deadline) · Last updated: 13 Oct 2026

---

## 1. What we're building
A web app where you link your coding-platform handles. It pulls in the problems you've solved and shows one dashboard: totals, a heatmap, difficulty and topic breakdowns. It also shows **your weak topics and what to solve next**. A public profile page (`/u/<name>`) works as a shareable portfolio.

**Why this one is different:** existing trackers (Codolio, CoderSTAT, CoderHub, Dsabuddy) mostly show totals and ratings. CodeLogs maps every platform's tags onto **one topic list**, scores your weak areas, and recommends **unsolved** problems at your level.

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
- **Auth for CodeLogs itself:** **Better Auth** with **GitHub** login (Drizzle adapter). It replaced Auth.js on 12 Oct 2026: Auth.js v5 never left beta and is now maintained by the Better Auth team.
- **Hosting:** Vercel Hobby (functions run up to 300 s with Fluid Compute) + Neon + Inngest Cloud. Locally: the Inngest dev server.
- **Package manager:** pnpm.
- **v1 platforms:** Codeforces (full), AtCoder (full, no tags), LeetCode (public counts and the 20 most recent solves, labelled "partial").
- **LeetCode access:** the server fetches public data **only on demand**: when the user clicks Sync, plus at most once a day. Responses are cached. Never passwords or cookies.
- **First differentiator:** a shared topic list, weak-topic scoring, and "solve next" recommendations.
- **UI kit:** Tailwind 4 + shadcn/ui (`base-nova` style, on Base UI). This was the default for open question #2 and was adopted in M1.
- **Charts (was open #1):** shadcn/ui charts (Recharts inside client components) + a custom SVG heatmap. Decided 13 Oct 2026.
- **Public profiles (was open #5):** opt-in; `users.public_profile` defaults to false. Decided 13 Oct 2026.
- **LeetCode backfill:** confirmed by the owner on 12 Oct 2026. Logged in, `leetcode.com/api/problems/all/` marks solved problems `"status": "ac"`, so the user-triggered JSON import (M5) is viable.
- **Later:** Chrome extension for full LeetCode history. HackerRank, CodeChef and GFG come after that, and only through the extension, never by server-side scraping.

**Still open (I'll ask when we reach them)**
| # | Question | My default |
|---|---|---|
| 3 | Topic list granularity | **Two levels:** 10 macro topics for the UI (radar/bar chart), with about 30 micro topics underneath for scoring and recommendations |
| 4 | Recommendation rule | Weakest macro topics → unsolved CF problems at rating +100–200 (primary). LC recommendations only for users with full LC history (backfill); otherwise marked "may already be solved" |
| 6 | Final product name | CodeLogs for now |

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
                    difficulty_norm 1-5, raw_tags jsonb, catalog_updated_at)
                                                               unique(platform, external_id)
catalog_syncs      (id, platform, started_at, finished_at, status, rows)
solves             (id, user_id, problem_id, first_solved_at, source api|extension)
                                                               unique(user_id, problem_id)
raw_payloads       (id, account_id, kind, fetched_at, payload jsonb)
activity_days      (user_id, platform, day, count)             unique(user_id, platform, day)
platform_stats     (account_id, kind, payload jsonb, fetched_at)  -- LC counts, CF rating
sync_runs          (id, account_id, started_at, finished_at, status, error, items)
topics             (id, slug, name, parent_id)
tag_mappings       (platform, raw_tag, topic_id)               unique(platform, raw_tag)
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
  lib/topics/               taxonomy.json, mappings/{codeforces,leetcode}.json, scoring.ts, recommend.ts
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
- **Done when:** a CF `dp` solve and LeetCode's DP count show under one "Dynamic Programming" topic, and recommendations exclude problems you've already solved.

### M5: Ship
- 🤖 Handle verification flow (CF organization, AtCoder affiliation, LC summary)
- 🤖 LeetCode backfill upload (if M0 confirmed it)
- 🤖 `syncStaleAccounts` daily Inngest cron
- 🤖 Account export and delete
- 🧭 README: problem, architecture diagram, screenshots, data limits
- 🧭 Deploy to Vercel + Neon; seed your profile; final review
- **Done when:** your live `/u/<you>` link works logged out and friends can sign up.

### Later
- M6: Chrome MV3 extension for full LeetCode history (sends accepts to our API with our token)
- M7: Sheet tracking (Blind 75 / NeetCode 150 / Striver)
- M8: CodeChef and GFG via the extension, plus revision reminders

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
- [ ] M2 adapters + sync (branch `m2-adapters-sync`, PR #2)
  - [x] `lib/adapters/http.ts` (timeout, retry/backoff on 429/5xx/network + CF call limit, per-host pacing); CF, AtCoder, LC adapters + catalog adapters with fixture tests
  - [x] Connect form validates handles against the platform (`lib/adapters/validate.ts`)
  - [x] `lib/sync/`: difficulty bands (1–5), cursors, idempotent upserts, run bookkeeping, atomic claim with a 5-min "Sync now" cooldown; migration `0001` (`sync_requested_at`)
  - [x] Inngest: `syncAccount` (fetch + write in one step per page, `step.sleep(minDelayMs)`), `syncCatalog` + daily `syncCatalogs` cron (LC Sundays only); both share an env-scoped per-platform concurrency limit of 1
  - [x] Connect page: Sync now / Sync all, last-synced time, errors, auto-refresh while syncing; a new handle syncs right away
  - [x] Verified live (test user, then deleted): catalogs CF 11,450 / AtCoder 9,752 / LC 4,081 rows; first sync CF 46, AtCoder `chokudai` 893 (5 pages, 23 s), LC 17 recent + 174 activity days (`partial`); second sync wrote 0 rows (row `xmin` unchanged); a missing CF handle fails in 1 s without retries while AtCoder and LC stay `ok`; a catalog sync and an account sync on one platform ran one after the other
  - [x] 👤 Owner: ran `pnpm dev` + `pnpm inngest:dev`, connected the 3 handles; first syncs landed (CF 46, LC 17 recent `partial`, AtCoder 0) (13 Oct 2026)
  - [x] Fix: "Sync all" said "Unknown platform". With no `platform` field, `FormData.get` returns `null`, which `z.enum().optional()` rejects
  - Known limits: Inngest concurrency counts running steps, so two accounts on one platform can interleave requests across serverless instances (in-process pacing covers one instance; CF's call limit is retried). AtCoder AHC `_b` problems aren't in kenkoooo's catalog and stay as stubs. Solves keep the first time seen (`DO NOTHING`); the M5 backfill may need "keep the earliest" instead (§4 decision, ask first).
- [ ] M3 dashboard + public profile (next)
