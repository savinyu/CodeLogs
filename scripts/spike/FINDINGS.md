# M0 Spike Findings (12 Oct 2026)

Scripts: `scripts/spike/{cf,atcoder,leetcode}.ts` (run with `pnpm spike:<platform>`). Small fixtures are committed in `fixtures/<platform>/`. Full dumps and per-run `report.json` files are in `spike-output/` (gitignored). All calls were anonymous and rate-limited.

## Codeforces (`savinyu`): ✅ works as planned
| Fact | Value / evidence |
|---|---|
| Full history in one call | `user.status?handle=savinyu` returned 110 submissions, 46 unique AC, in about 1.9 s |
| Order | Strictly newest-first by `id`; `from=1&count=5` returned the same 5 newest ids |
| Verdicts | OK 47, WA 47, SKIPPED 10, CE 3, RE 2, TLE 1 (47 OK rows collapse to 46 unique problems) |
| Catalog | 11,450 problems; 298 have no rating, 180 have no tags; 38 distinct tags (`fixtures/codeforces/tags.json`) |
| **Catalog gap** | Problem 1782A (accepted) is missing from `problemset.problems`; the whole of contest 1782 is absent. The submission's inline `problem` object still has its name, rating and tags |
| Unknown handle | HTTP **400**, `status:"FAILED"`, comment `handle: User with handle X not found`. A badly formed handle gives a 400 with a length-validation comment |
| Verification field | `user.info.organization` is free text (currently "IIT Rookee"; you may want to fix that typo on Codeforces) |

**Design impact**
- Cursor = `maxSubmissionId`. First sync: no `count`. Incremental syncs fetch pages with `from=1&count=50`, continuing until an id ≤ cursor, then advance the cursor to the max id seen.
- Join to the catalog with a **left join**, falling back to the submission's inline `problem` fields. A user sync may insert a stub problem row, and the catalog sync later fills or overwrites it.
- `validateHandle`: 200 + OK means valid; 400 + FAILED means invalid (show the comment); network error or 5xx means retry.

## AtCoder (kenkoooo; `savinyu` empty, `chokudai` as sample): ✅ works, two caveats
| Fact | Value / evidence |
|---|---|
| Paging | 500 rows/page, ascending `epoch_second`; chokudai = 4×500 + 236 = 2,236 rows → 2,232 unique ids |
| **Boundary overlap** | `from_second` is **inclusive**: each page repeats the boundary row(s) |
| Results | AC, CE, RE, TLE, WA |
| AC count shortcut | `v3/user/ac_rank` → `{count: 893, rank: 5739}`; matches 893 unique AC from the pages |
| Catalog | 9,728 problems, 5,175 models, 6,549 contests. **4,577 problems (47%) have no model**, and 286 models have no `difficulty`. Range −10000 to 4383. **No tags anywhere** |
| **Unknown user** | kenkoooo returns `200 []`, identical to an account with no submissions, so it **cannot validate handles** |
| Verification field | atcoder.jp profile `<th>Affiliation</th><td>…</td>` parsed to "AtCoder Inc. CEO" |

**Design impact**
- Cursor = last `epoch_second`, inclusive. Dedupe by submission `id`. Stall guard: if a page adds no new ids and its last second equals `from_second`, stop.
- `validateHandle` and verification use **one** atcoder.jp profile GET (expect 404 for unknown users; to confirm in M2), not kenkoooo.
- `difficulty_norm` is nullable; the UI shows "unrated".
- Raw negative difficulty values are kept; normalise to 1–5 by clamping.

## LeetCode (`CptDailyBird`): ✅ public data as expected
| Fact | Value / evidence |
|---|---|
| Stats | All 319 (E81/M195/H43), 611 submissions; catalog 4,081 (E971/M2128/H982) |
| Tag counts | 40 tag slugs (`fixtures/leetcode/tag-slugs.json`). These are **lifetime** counts, so they drive topic scoring. Only solved tags are listed, and only from a **fixed set of 47** (re-checked 13 Oct 2026 on three heavy profiles): finer catalog tags like `prefix-sum`, `counting`, `number-theory`, `memoization` are never counted, and the counts say `heap` where the catalog says `heap-priority-queue`. See `LEETCODE_COUNTED_TAGS` |
| Calendar | Default = **rolling last year** (57 days, 2026-04-09 → 2026-10-08). `userCalendar(year:Y)` gives each earlier year (2023: 14 days). Keys are UTC-midnight epoch seconds |
| Recent AC | 20 items → **17 distinct slugs** (re-solves repeat), so dedupe by slug and keep the earliest timestamp |
| Question details | `question(titleSlug)` returns difficulty and topicTags for all 17 |
| Catalog | `questionList` works; **page size capped at 100** (asking for 1000 silently returns 100) → 41 requests, about 45 s per weekly sync |
| Unknown user | HTTP **200** with `errors[0].message = "That user does not exist."` and `matchedUser: null` |
| Verification field | `profile.aboutMe` is returned (currently empty) |
| Throttling | None seen in 2 runs of 26 requests each at 1 req/s |

**Design impact**
- Full activity history = default calendar + one call per earlier `activeYear` (about 4 calls), upserted into `activity_days`.
- If the catalog already has a slug, no `question` call is needed; only unknown slugs get one.
- `validateHandle` checks `data.matchedUser === null`, not the HTTP status.

## Still open
- ~~👤 LeetCode logged-in backfill~~: confirmed by the owner on 12 Oct 2026.
- ~~AtCoder unknown-user status~~: confirmed in M2. `atcoder.jp/users/<unknown>` returns **404**. Handles are case-insensitive (`/users/CHOKUDAI` is 200); the page's `.username` link has the canonical casing.

## M2 live sync notes (12 Oct 2026)
- LeetCode accepts the honest `CodeLogs/0.1` User-Agent; no browser UA needed.
- kenkoooo's catalog lacks some AtCoder Heuristic Contest `_b` problems (6 of chokudai's solves), so those stay as stub rows.
- Full catalog refresh: CF 37 s, AtCoder 32 s, LC 60 s (41 pages). Repeat refreshes write only changed rows.

## Contests and badges probe (14 Oct 2026, for M6)
| Platform | Endpoint | Result |
|---|---|---|
| Codeforces | `user.rating?handle=savinyu` | `OK`, 20 rated contests; the last one is CodeTON Round 5 (contest 1842), rank 10469, 946 → 839 |
| LeetCode | `userContestRanking(username)` | `lee215`: 27 attended, rating 2204, global rank 7558, top 0.9 %, badge "Guardian". `CptDailyBird`: `null` (no contests) |
| LeetCode | `userContestRankingHistory(username)` | `lee215`: 27 rows, all `attended`. `CptDailyBird`: empty. The list can include unattended rows, so filter on `attended` |
| LeetCode | `matchedUser.badges` | `CptDailyBird`: `{id, displayName, icon, creationDate}`, e.g. "50 Days Badge 2026". Some `icon` values are relative (`/static/images/badges/…`) |
| AtCoder | `atcoder.jp/users/chokudai/history/json` | 200, 42 rows (`IsRated, Place, OldRating, NewRating, Performance, InnerPerformance, ContestScreenName, ContestName, ContestNameEn, EndTime`). **Disallowed by robots.txt** (`Disallow: /users/*/history/`) |

`robots.txt` check: LeetCode disallows `/graphql` for `*`, which the existing LC adapter already uses (PLAN.md §4 open #8). AtCoder also disallows `/submissions/` and contest standings; the profile page `/users/X` that we use for validation is allowed.

## Adapter interface changes (applied to PLAN.md §6)
- `validateHandle` now returns `{ result: "valid" | "invalid" | "retry"; canonicalHandle?: string; message?: string }` instead of a boolean.
- `NormalizedSolve.problemFallback` holds inline problem metadata for catalog misses.
- Adapters dedupe within a page (CF by problem key, AtCoder by submission id, LC by slug) before returning.
