# Data access research, group 2 (verified 2026-10-18)

All live checks: plain `curl`, UA `Mozilla/5.0 (compatible; CodeLogsResearch/1.0)`, no login, no cookies, a handful of requests per site, 1.6 s apart. Samples are in `/private/tmp/claude-502/-Users-Savinyu-Pant-Desktop-Projects-CodeLogs/e8ede94f-8644-4940-8efb-b28b054a2ff7/scratchpad/samples-group2/` (file names are cited below). "Verified" means I saw it in a live response on 2026-10-18. "Reported" means read in docs or search results only.

## Ranked summary

| # | Platform | API | Auth | Solved list? | Timestamps? | Tags/difficulty? | Catalog? | Verification field | robots/ToS OK? | Relevance | Fit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | DMOJ | official (documented) | none for public data (token optional) | yes (codes) | yes, via submissions endpoint | tags (`types`) + points | yes | `about` (bio) | robots unreadable (Cloudflare); API usable, 90 req/min | niche, active | full adapter |
| 2 | Codewars | official (documented) | none | yes (200/page) | yes (`completedAt`) | rank (kyu) + tags, per-kata call only | no list (single kata only) | no bio; `name`/`clan` editable | robots allows all; ToS bans scraping "Services", API is advertised | active, kata-style, medium-high | full adapter |
| 3 | yukicoder | official (swagger) | none | yes | no (only problem release date) | Level + Tags (Japanese) | yes | none (no bio) | no robots (404); ToS not found | active, Japanese CP, medium | full adapter minus timestamps and verification |
| 4 | UVa via uHunt | community-run, documented | none | yes (all submissions) | yes (unix + verdict) | no tags/difficulty (acceptance stats only) | yes | none | no robots (404); CORS open | classic, declining but live, medium | full adapter minus verification |
| 5 | Library Checker | REST API the frontend uses, OpenAPI in repo | none | yes (`solved_map`) | no | no (names/titles only) | yes | `library_url` (URL only) | robots allows all; no ToS found | niche (JP), live | full adapter, tiny audience |
| 6 | clist.by | official, keyed | API key (login) | no | n/a | problem `rating` only | yes (problems) | n/a | `Disallow: /api/` in robots, ToS allows keyed API for personal/community use | wide aggregator, high | ratings/contests only, no solved counts |
| 7 | Topcoder | official v6 | none for member profile | no (not problem-based) | n/a | n/a | n/a | `description` (bio) | robots allows all | niche (SRM/challenges) | ratings only |
| 8 | leetcode.cn | GraphQL used by site (reported) | none | reported yes | reported | reported | n/a | `aboutMe` (reported) | `/api` disallowed; GraphQL path not listed; Cloudflare 403 to curl | big in China | unverified, probably blocked |
| 9 | Luogu | no official API; front-end JSON mode | none | `passedProblemCount` often null | no | no | no | `slogan`/`introduction` | robots disallows `/record`, `/paste` only | huge in China, Chinese only | no (fragile) |
| 10 | Eolymp | official (docs.eolymp.com) | API key or OAuth | per-space, auth'd | n/a | n/a | n/a | n/a | not read | medium (Ukraine/EU) | no (auth needed) |
| - | Kattis, SPOJ, CSES, Timus, Toph, beecrowd, LightOJ, Project Euler, HackerEarth, AcWing | none usable | - | - | - | - | - | - | - | varies | no |

Recommendation order: DMOJ, Codewars, yukicoder, uHunt, then Library Checker if wanted. clist.by is a different product (rating tracker) and is the only route to CodeChef-style ratings.

---

## DMOJ (dmoj.ca)

- **API:** official, "simple JSON API", docs at https://docs.dmoj.ca/#/site/api (source: https://raw.githubusercontent.com/DMOJ/docs/master/docs/site/api.md, verified readable). Base `https://dmoj.ca/api/v2/`.
- **Auth:** none needed for public data (verified, no header sent). Optional `Authorization: Bearer <API Token>` from the Edit profile page. Reported by docs: "**90 requests per minute** ... If you exceed this limit, you will be captcha'd" (3-day captcha window).
- **User (`/api/v2/user/<name>`, verified):** `id, username, about, points, performance_points, problem_count, solved_problems (list of problem codes), rank, rating, organizations, contests[{key, score, cumulative_time, rating, raw_rating, performance}]`. Sample: `dmoj_user.json`, `dmoj_user_big.json` (Xyene: 1004 solved codes, `about` is free text).
- **Timestamps:** not in the user object. `/api/v2/submissions?user=<name>&result=AC` returns `id, problem, user, date (ISO), language, time, memory, points, result, contest`, 1000 per page with `has_more` (verified, `dmoj_subs.json`). So a full adapter is a two-step: user list for the set, submissions for dates.
- **Catalog (`/api/v2/problems`, verified):** `code, name, types[] (topic tags), group, points, partial, is_organization_private, is_public`, 1000 per page, `has_more`. Single problem adds limits and languages (`dmoj_prob1.json`). Difficulty is `points` (not a rating).
- **Verification field:** `about` (verified present, string or null). Fits the paste-a-code scheme.
- **Unknown handle (verified):** HTTP 404, `{"api_version":"2.0",...,"error":{"code":404,"message":"page/object not found"}}` (`dmoj_user_unknown.json`).
- **robots/ToS:** `https://dmoj.ca/robots.txt` and `/tos/` returned a Cloudflare "Just a moment..." challenge (HTTP 403) to curl and WebFetch, so I could not read them. The API paths themselves returned 200 JSON on 8 requests with no challenge. Unknown: ToS clause on API use. Risk: Cloudflare could challenge a server IP.
- **Relevance:** active (submissions fetched are current to 2026), a Canadian contest community (DMOPC, CCC). Niche for interview prep.

## Codewars

- **API:** official v1, docs https://dev.codewars.com/ (WebFetch): "Not required. API v1 endpoints are all public." Only rate-limit mention is that HTTP 429 means too many requests; no number published. Response headers had no rate-limit headers (verified).
- **User (`/api/v1/users/{user}`, verified):** `id, username, name, honor, clan, leaderboardPosition, skills, ranks{overall, languages{...}}, codeChallenges{totalAuthored, totalCompleted}` (`cw_user.json`).
- **Solved list (`/api/v1/users/{user}/code-challenges/completed?page=0`, verified):** `{totalPages, totalItems, data:[{id, name, slug, completedLanguages[], completedAt (ISO)}]}`, 200 per page, page is 0-based (`cw_completed.json`). Timestamps are per kata and language-aware.
- **Per-kata (`/api/v1/code-challenges/{slug}`, verified):** `rank{id,name}` (kyu = difficulty), `tags[]`, `category`, `totalCompleted`, `voteScore`, `languages` (`cw_kata.json`). Needs one call per kata (2644 for a heavy user), so cache by slug.
- **Catalog:** none (no list-all endpoint).
- **Verification field:** no bio field in the API. User-editable fields exposed are `name` and `clan`; either could hold a pasted code (unverified that users can freely set them).
- **Unknown handle (verified):** HTTP 404 `{"success":false,"reason":"not found"}`.
- **robots (verified):** `User-agent: *` / `Disallow:` / `Disallow: /cgi-bin/` (everything allowed).
- **ToS (verified, https://www.codewars.com/about/terms-of-service, updated 6 Oct 2025):** forbids anyone who "'Crawls,' 'scrapes,' or 'spiders' any page, data or portion of or relating to the Services or Content ... through the use of any robot, spider or other automatic device". No carve-out for the public API in the text I found. The API is publicly documented, so use is plausibly intended, but the clause is a risk worth an email to the owner.
- **Relevance:** very active. Kata puzzles, more language practice than DSA/interview prep.

## yukicoder (yukicoder.me)

- **API:** official, Swagger at `https://yukicoder.me/api/swagger.yaml` (verified, readable). Base `/api/v1`. The user endpoint notice says: "このAPIはベータ版です。予告なく変更される場合があります。404を返したら廃止です。" (beta, may change without notice).
- **Auth:** none for the read endpoints I used. Bearer API key only for submitting and editing.
- **User (`/api/v1/user/name/<name>`, also `id` or `twitter`, verified):** `Id, Name, Solved, Level, LevelFloat, Rank, Score, Points, Notice, AtCoderId, CodeforcesId` (`yuki_user.json`). Note the plural `/users/name/` is a 404 HTML page.
- **Solved list (`/api/v1/solved/id/{id}`, verified):** array of `{No, ProblemId, Title, AuthorId, TesterIds, Level (difficulty, e.g. 2.5), ProblemType, Tags (comma string, Japanese), Date}` (`yuki_solved.json`, 914 items for Rubikun). `Date` is the problem's release date, not the solve date, so there are no solve timestamps. `/solved/.../first` returns first-AC (pre-rejudge) list.
- **Catalog (`/api/v1/problems`, verified):** all problems, same fields, 670 KB (`yuki_problems.json`). `Tags` is empty for some in the list but filled in `/problems/{id}` and in `/solved`.
- **Verification field:** none (no bio). Only linked `AtCoderId`/`CodeforcesId` strings.
- **Unknown handle (verified):** 404 `{"Message":"指定したユーザーは存在しません"}`. Duplicate names resolve to the oldest ID; prefer storing numeric `Id`.
- **robots/ToS:** `/robots.txt` 404 ("No matching route found"); `/about` 404, ToS not located. Rate limit: none stated.
- **Relevance:** active Japanese CP site; popular with AtCoder users, so audience overlaps with the AtCoder adapter.

## UVa Online Judge via uHunt

- **API:** community-run, documented at https://uhunt.onlinejudge.org/api (verified). Doc statement: "You can call any of the service URL ... directly from a client browser (it allows AJAX requests from any origin)". Mailing list uhunt-api.
- **Auth/rate limits:** none, none stated.
- **Handle to id:** `/api/uname2uid/{uname}` returns a bare integer (verified: `soda625` gives `76803`).
- **Solved list:** `/api/subs-user/{uid}` returns `{name, uname, subs:[[sid, pid, verdict, runtime_ms, unix_time, lang, rank]]}` (verified, `uhunt_subs_76803.json`; verdict 90 means AC, seen in `/api/p/subs`). Optional `/{min-sid}` for incremental sync. Gives timestamps and every submission, so solved set and heatmap are derivable.
- **Catalog:** `/api/p` returns all problems as arrays (id, number, title, DACU, best runtime, counts per verdict, status). 465 KB (`uhunt_plist.json`). No tags and no difficulty; DACU (distinct accepted users) is a usable proxy. No topic tags anywhere.
- **Verification field:** none (only `name`/`uname`).
- **Unknown handle (verified):** uname2uid returns HTTP 200 with body `0`. `subs-user/999999999` returns 200 `{"name":"--- ? ---","uname":"--- ? ---","subs":[]}`.
- **robots:** `https://uhunt.onlinejudge.org/robots.txt` is 404 ("Cannot GET /robots.txt"). No ToS found.
- **Liveness:** verified. Problem 36 submissions with `sbt` 1780031705 (mid-2026) came back, so judging is still active.
- **Relevance:** classic CP training set (Competitive Programming book), many users; declining but live.

## Library Checker (judge.yosupo.jp)

- **API:** the site's own REST backend, spec in https://github.com/yosupo06/library-checker-judge/blob/master/restapi/openapi/openapi.yaml; host found in the frontend `.env.production`: `VITE_REST_API_URL=https://v3.api.judge.yosupo.jp:443`. Not advertised as a public API.
- **Auth:** none for these GETs (verified).
- **User (`/users/yosupo`, verified):** `{"user":{"is_developer":true,"library_url":"https://github.com/...","name":"yosupo"}}`.
- **Solved (`/users/{name}/statistics`, verified):** `{"solved_map":{"<problem_name>":"AC"|"LATEST_AC"}}` (`lc_stat3.json`). `LATEST_AC` means the latest submission passes. No timestamps; `/submissions` list exists in the spec but not tested.
- **Catalog (`/problems`, verified):** `[{name, title}]` only, no tags/difficulty.
- **Verification field:** `library_url` only (a URL, probably validated, so not a free-text bio).
- **Unknown handle (verified):** HTTP 400 text `invalid user name`.
- **robots (verified):** `User-agent: *` / `Disallow:` (allow all). No ToS found. Note `judge.yosupo.jp/api/...` is the SPA (HTML), not the API.
- **Relevance:** niche (about 100-200 curated library problems), Japanese/algorithm-library crowd. Unannounced host could change.

## clist.by (aggregator)

- **API:** official v4, https://clist.by/api/v4/doc/ (verified). Swagger schema readable without a key: `https://clist.by/api/v4/doc/resources/` then `/api/v4/doc/schema/{account,statistics,problem}/` (saved as `clist_schema_*.json`).
- **Auth (verified quote):** "Accessing the API requires an API key, available to authenticated users." Anonymous `GET /api/v4/account/?limit=1` returned HTTP 401 (verified). Website sessions and OAuth also work.
- **Rate limit (verified quote):** "Standard request limit is 10 per minute. Should you require a higher limit, please let us know."
- **What it exposes per account (verified from schema):** `account` model fields: `id, resource, resource_id, handle, name, rating, n_contests, resource_rank, last_activity`; filters by `handle`, `resource`, `rating`. `statistics` (per contest): `account_id, handle, contest_id, event, date, place, score, new_rating, old_rating, rating_change, problems, more_fields`. So rating history and contest participation, not problems-solved counts. `problem` model: `name, resource, slug, url, rating, n_attempts, n_accepted, ...` plus filters `solved`, `user_solved`, `system_solved` that are tied to a logged-in coder's own lists.
- **Per-user solved counts:** not in the account model. Per-contest `problems` results exist only for contests it tracks as standings. Treat as unavailable.
- **Verification field:** none in API. robots disallows `/account/*/verification/` (the site has its own account-linking flow).
- **robots (verified):** `Allow: /api/v*/doc` then `Disallow: /api/`. Quoted. Keyed API users are not crawlers, but the line is worth noting.
- **ToS (verified, https://clist.by/terms/):** "CLIST may provide a free API intended mainly for personal, educational and community projects." Prohibits sharing credentials, reselling "CLIST's raw data as a competing contest API or commercial data feed without a separate agreement", and harmful automated requests; "We may change rate limits, API endpoints or access policies at any time".
- **Relevance:** the only practical route to ratings on CodeChef and many other sites. High as an aggregator.
- **Fit:** a single owner-held API key at 10 req/min cannot serve many users' syncs. Only suitable for contest ratings or contest results, with strict caching.

## Topcoder

- **API:** v6 member API works unauthenticated (verified); v5 paths all 404 (`/v5/members/{Petr,tourist}`, `/stats`, `/stats/history`: HTTP 404 `{"message":"Not Found"}`), so v5 is gone or moved.
- **Member (`https://api.topcoder.com/v6/members/Petr`, verified):** keys `userId, handle, firstName, lastName, tracks, status, addresses, description, country, homeCountryCode, maxRating{rating, track, subTrack}, skills, createdAt, ...`. It exposes real names and city (PII, avoid storing).
- **Stats (`/v6/members/Petr/stats`, verified):** per-track `challenges`, `wins`, `subTracks[]`, `maxRating`. SRM ratings and challenge wins. No problem list.
- **Verification field:** `description` (bio) exists (verified; Petr's holds a URL).
- **Unknown handle (verified):** HTTP 404 `{"message":"Member with handle: \"...\" doesn't exist"}`.
- **robots (verified):** `Allow: /`. ToS URL I guessed 404; not read.
- **Relevance:** niche now. No solved-problem concept, so only a ratings widget.

## leetcode.cn (LeetCode China)

- **API:** reported (not verified here): GraphQL at `https://leetcode.cn/graphql/noj-go/` with `userProfilePublicProfile(userSlug)`. My two POSTs returned HTTP 403 Cloudflare "Just a moment..." (`lccn_profile.json`), so it is blocked for non-browser clients; I did not try to bypass it.
- **robots (verified):** `Disallow: /api`, `Disallow: /*/api`, `Disallow: /u/`, `Disallow: /submissions`, `Disallow: /progress`. `/graphql` is not listed.
- **Verdict:** unverified. Needs a separate adapter (userSlug, different problem IDs and ratings) and may be unreachable from datacentre IPs. Not recommended now.

## Luogu (luogu.com.cn)

- No official API. The site serves its own JSON when `x-lentille-request: content-only` is sent (verified on `/user/1`: keys `prizes, gu, elo, dailyCounts, user`; `user` has `uid, name, slogan, introduction, ranking, passedProblemCount, registerTime`). `passedProblemCount` was `null` for that user. A second user returned HTTP 403, and `/problem/list?_contentOnly=1` returned HTML (200).
- robots: `Disallow: /record`, `/recordnew`, `/paste`. ToS not read.
- It is an internal front-end format, not a contract; Chinese-only site; skip.

## Eolymp

- Official API at https://docs.eolymp.com (reported via fetched index): services `community.MemberService`, `atlas.ProblemService`, `atlas.SubmissionService` (`AggregateSubmissions`), `atlas.ScoringService`. Auth is an API key or OAuth 2.0 token (reported); the index says a caller without space-wide permission "gets only their own" submissions, so third-party user data is likely not public. `eolymp.com` and `eolymp.com/en` timed out from my network (HTTP 000), so nothing live was verified. Not a fit.

## No usable public API (checked)

- **SPOJ:** no official API found in search. `spoj.com` and `/users/...` return Cloudflare 403 to curl. robots (verified): `Disallow: /*/status/`, `/*/ranks/`, `/status*`. HTML scraping only, excluded.
- **CSES:** `cses.fi/robots.txt` 404. User page `cses.fi/user/1` (verified) shows only submission counts and languages; `cses.fi/problemset/user/1/` says "Please login to see the statistics". No API.
- **Kattis (open.kattis.com):** no official API (search: only unofficial wrappers that scrape or need a login). robots (verified): `Disallow: /submissions`, `Disallow: /users`. User pages 404 for the handle I guessed; scraping would hit the disallowed `/users`.
- **Timus:** no API found. `acm.timus.ru/author.aspx?id=150366` is HTML with the solved map and "Problems solved 17 out of 1226" (verified), unknown author shows "Author not found". robots (verified) `Disallow: /status.aspx?`, `/rating.aspx`, `/ranklist.aspx?`; `/author.aspx` is disallowed only for bingbot. HTML scraping, excluded.
- **Toph:** staff said JSON for profile/submissions is "just a different format" and not a real API (reported, community.toph.co/t/about-api-of-this-site/6076). `toph.co/p/copycat.json` works (verified, problem statements) but `toph.co/u/<handle>.json` returns 404 (verified). robots (verified): `Disallow: /api`, `Disallow: /settings`, plus `Content-Signal: ai-train=no, search=yes, ai-input=no`. No.
- **beecrowd:** no API found (search). Judge pages return Cloudflare 403 to curl. robots allows `/` for generic agents but blocks many AI bots by name. No.
- **LightOJ:** `lightoj.com` loads (200), robots.txt 404, no API found. No.
- **Project Euler:** no API; robots.txt 404; `projecteuler.net/progress=<user>` returned the generic public page (verified), progress is private without login. No.
- **HackerEarth:** official v4 API is code evaluation only (reported, hackerearth.com/docs/wiki/developers/v4/). No user-profile endpoint documented. robots: `Allow: /`, `Disallow: /*AJAX`. No.
- **AcWing:** `acwing.com` timed out from my network (HTTP 000). Search: only OAuth login APIs and cookie-based scrapers (reported). No.
- **Extras:** vjudge.net `GET /user/solveDetail/<user>` returned JSON of AC problems per judge (verified, `vj_solve.json`) but robots says `Disallow: /user/`, so excluded. Exercism profile API is behind Cloudflare 403, and Exercism is not DSA.

## Notes for CodeLogs

- Handle-ownership check: DMOJ (`about`) fits cleanly; Codewars (`name`/`clan`) maybe; Topcoder (`description`) exists but ratings-only; yukicoder, uHunt, Library Checker have no free-text field, so they would need a trust-on-first-use or a different proof.
- Cloudflare gates (DMOJ robots, leetcode.cn, SPOJ, beecrowd, Exercism, Luogu partly) can start challenging server IPs at any time; the working ones (DMOJ API, Codewars, yukicoder, uHunt, Topcoder, Library Checker, clist docs) returned plain JSON with no challenge.
- Suggested politeness delays if built: DMOJ 700 ms (90/min), Codewars 500 ms, yukicoder 1000 ms, uHunt 1000 ms, clist 6500 ms.
