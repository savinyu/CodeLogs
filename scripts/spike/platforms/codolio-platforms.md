# Group 1 platforms: CodeChef, GFG, HackerRank, InterviewBit, Code360

All "verified" items were checked live on 2026-10-18 with plain curl (browser UA, no cookies, no login, >=1.5 s apart). Samples are in `/private/tmp/claude-502/-Users-Savinyu-Pant-Desktop-Projects-CodeLogs/e8ede94f-8644-4940-8efb-b28b054a2ff7/scratchpad/samples-group1/`. Personal fields were redacted from the IB and Code360 profile samples. "Reported" means read in docs or GitHub, not tested by me.

Headline: all five expose a solved count without login, but through five different mechanisms, and only GFG and InterviewBit have a clean "public JSON, not blocked by robots.txt" path. HackerRank's data endpoints are disallowed by robots.txt. CodeChef's ToS bans scraping outright. Code360 works but its ToS could not be retrieved.

---

## 1. CodeChef

1. **Official API.** `https://developers.codechef.com/` no longer resolves (NXDOMAIN, verified; no Wayback snapshot). `https://api.codechef.com/users/<h>` still answers `401 {"status":"error","result":{"errors":[{"message":"Unauthorized for this resource scope","code":"unauthorized"}]}}`. So the OAuth2 API backend is alive, but the developer portal is gone. Reported (CodeChef Discuss, Oct 2019, admin Abhijeet Pandey): third parties had to email api@codechef.com for access, and the website's internal API "is meant to be used by the website only". There is no self-service signup. Shutdown date: not determined.
2. **Unofficial JSON.** No per-user JSON endpoint verified. `GET https://www.codechef.com/api/list/problems/easy?limit=1` returns 200 JSON with no auth (global problem catalogue: code, name, difficulty_rating, contest_code, submission counts), but nothing per user. `/recent/user` (recent submissions) is disallowed by robots.txt, so I did not call it.
3. **Profile HTML** (`https://www.codechef.com/users/gennady.korotkevich`, 200, 180 KB) is server-rendered (Drupal plus Ember, no `__NEXT_DATA__`). Verified in the plain HTML:
   - `<h3>Total Problems Solved: 632</h3>`
   - Problem **names** grouped under "Contests (102)", "Practice Paths", "Learning Paths". These are display names only: no problem codes, no hrefs, no timestamps, no tags or difficulty.
   - Rating history embedded as JS (`all_rating = [...]` and `date_versus_rating`): code, name, rating, rank, end_date per contest.
   - Fields: name, Username, Country, Student/Professional, Institution, star rating, highest rating.
   - The submission heatmap array (`userDailySubmissionsStats`) was empty `[]` in the HTML, so it is loaded elsewhere.
4. **robots.txt** (`www.codechef.com/robots.txt`, `User-agent: *`). Relevant lines: `Disallow: /problems/*`, `Disallow: /status/*`, `Disallow: /viewsolution/*`, `Disallow: /recent/user`, `Disallow: /rankings/*`, and `Disallow: /A` through `/Z` (uppercase single letters only; paths are case-sensitive). There is no `/users` or `/api` rule. **`/users/<handle>` is not disallowed** for `*`. The comment says the A-Z rules are to disallow "contest pages, their respective problem pages and status pages".
5. **ToS** (`https://www.codechef.com/terms`, verified). Section 14 "Prohibited Uses": "you are prohibited from using the site or its content: ... to collect or track the personal information of others; to spam, phish, farm, pretext, spider, crawl, or scrape; ..." and "We reserve the right to terminate your use of the Service". **Scraping is explicitly prohibited**, even though robots.txt permits `/users/`.
6. **Unknown handle.** `GET /users/zzqxnonexist98765` returns `302` to `https://www.codechef.com/` with an empty body. Treat a redirect to `/` as "not found".
7. **Logged-in browser.** Unverified (needs login). The submissions and practice pages (`/submissions?...`, `/status/...`) are inside robots-disallowed paths. An extension reading the user's own session is a separate case from server crawling.
8. **Open source** (reported). Everything is HTML scraping: arhankundu99/codechef-crawler (requests+bs4), dog-broad/CodeChef-Rating-Api, Ashok-Bhatt/ScrapeSpidey (Puppeteer reading `.rating-data-section.problems-solved h3`, which matches what I saw). adityasinha513/Coding-Profile-Scrapper warns CodeChef changes templates and sometimes puts a Cloudflare challenge in front. The page is behind Cloudflare, but plain curl with a browser UA passed.
- **Verification field.** No bio or about field. Name, Institution and Country exist. Whether any of them is free text a user can set to a code is **unverified**.
- **Best source for solved count:** the `/users/<h>` HTML (`Total Problems Solved: N`). The solved list is only partly public (names, no ids).

---

## 2. GeeksforGeeks

1. **Official API.** None found.
2. **Unofficial JSON** (what the profile frontend calls; reported by tashifkhan/GFG-Stats-API source, `services/client.py`, and **verified live**). Both are unauthenticated, handle in the request, with `Origin`/`Referer: https://www.geeksforgeeks.org/` headers sent.
   - **A.** `GET https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=<h>&article_count=false&redirect=true`, 200 JSON. Fields: name, institute_name, organization_name, designation, school, score, monthly_score, **total_problems_solved** (170), institute_rank, pod_solved_current_streak and longest streaks, pod_correct_submissions_count, total_articles_published, created_date, profile_image_url.
   - **B.** `POST https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/` with JSON body `{"handle":"<h>","requestType":"","year":"","month":""}`, 200. This returns the **full solved list**: `result: { "Easy": { "<problemId>": {slug, pname, lang, user_subtime:"2025-03-18 00:30:33"} }, "Basic":..., "Medium":..., "Hard":... }`. Verified for one handle: 67 Easy + 11 Basic + 81 Medium + 11 Hard = 170, matching `total_problems_solved` in A. Difficulty is the bucket; there are no tags. `user_subtime` is a timestamp (timezone unspecified, probably IST). `requestType`/`year`/`month` are used for the heatmap (reported, not tested). Problem URL is `https://www.geeksforgeeks.org/problems/<slug>`.
   - No rating or contest history in these two calls. GFG has no separate rating system (the "score" is practice points).
3. **Profile HTML** `https://www.geeksforgeeks.org/profile/<h>` (also `/user/<h>` which 301s there). Next.js App Router, **no `__NEXT_DATA__`**, but the RSC payload (`self.__next_f.push`) in the plain HTML embeds the same object as call A, including `total_problems_solved:170`, and the `<title>` has name and designation. So the count is in the SSR HTML, but the format is fragile (RSC flight data). An unknown handle gives title `undefined | GeeksforGeeks Profile` with status 200.
4. **robots.txt** (`www.geeksforgeeks.org/robots.txt`, `User-agent: *`): `Disallow: /wp-admin/`, `/community/`, `/search/`, `/wp-content/plugins/`, `/connect/`, `/content-override.php`. No `/profile` or `/user` rule. Named bots `CCBot`, `anthropic-ai`, `cohere-ai`, `Bytespider` get `Disallow: /`; `Applebot` is blocked from `/tag/` and `/category/`. **`/profile/<h>` is allowed for `*`.** `authapi.` and `practiceapi.geeksforgeeks.org/robots.txt` both return 404 (no robots file on the API hosts). Note: a bot identifying as `anthropic-ai` is disallowed from the whole www host. Our own UA is not in that list.
5. **ToS** `https://www.geeksforgeeks.org/legal/terms-of-use/` (verified). Clauses: "(6) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise"; prohibited: "Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools"; "use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services"; "Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise." **Broad prohibition of automated access.**
6. **Unknown handle.** A: `400 {"message":"User not found!"}`. B: `406 {"status":"failed","message":"Please send valid User Details","result":{},"count":0}`.
7. **Logged-in browser.** Not needed: B is already public, the profile is public by default. Whether private profiles exist: not determined.
8. **Open source.** tashifkhan/GFG-Stats-API (FastAPI, uses A and B, the current JSON endpoints, README says it moved off scraping the old pages), napiyo/geeksForGeeksStatsAPI (old: cheerio on `/user/<h>`, last push Mar 2025, probably broken by the new profile page), sukesh2000 and arnoob16 GeeksForGeeksAPI (HTML scraping, old). Reported only; I did not check how stable A and B have been.
- **Verification field.** None free-text in A: name, designation, institute, organization are editable (unverified whether the user can set them to a code).
- **Best source:** B for the full list with timestamps and difficulty buckets; A for count and streak.

---

## 3. HackerRank

1. **Official API.** The documented HackerRank API (`api/v3`) is HackerRank for Work (customer tests and candidates), requires a customer token, and has no per-user practice stats. Public user API: none found.
2. **Unofficial JSON** (verified, 200, no auth, `Accept: application/json`):
   - `GET https://www.hackerrank.com/rest/contests/master/hackers/<h>/profile` returns `{model:{username, name, country, school, company, created_at, level, followers_count, **short_bio**, website, linkedin_url, github_url, job_title, avatar, title ...}}`. No solved count.
   - `GET https://www.hackerrank.com/rest/hackers/<h>/badges` returns `models[]` per domain: badge_name, stars, level, current_points, **`solved`**, `total_challenges`, `hacker_rank` (rank). E.g. Problem Solving solved=202 of 563. Total solved = sum across badges (careful about double counting across overlapping domains; not tested).
   - `GET https://www.hackerrank.com/rest/hackers/<h>/submission_histories` returns `{"2013-09-13":1, ...}`: submission counts per day (983 days, 3663 submissions for the tested user). It counts submissions, not solves.
   - `GET https://www.hackerrank.com/rest/hackers/<h>/recent_challenges?limit=3` returns `models[{name, ch_slug, con_slug, created_at, url}]` plus `cursor` and `last_page`. This is paginated recent challenges the user submitted to; not guaranteed to be "solved". No difficulty or tags.
   - Reported (tashif.codes docs, not tested): `/rest/hackers/<h>/rating_histories_elo`.
3. **Profile HTML** `https://www.hackerrank.com/profile/<h>`, 200, 609 KB. The plain HTML includes `<script type="application/json" id="initialData">` and `id="initialUserData"` containing `short_bio` (URL-encoded) and profile fields. **No solved counts in the HTML**; those come from the `/rest/` calls above.
4. **robots.txt** (`www.hackerrank.com/robots.txt`, `User-agent: *`): `Disallow: /profile/`, `Disallow: /rest/`, `Disallow: /contests/` (with `Allow: /contests$` and `Allow: /contests/software-engineer-prep-kit/`), `Disallow: /tests/`, `Disallow: /x/settings/`, `Disallow: /*?*h_r=`. **Both the profile page and every `/rest/` endpoint above are DISALLOWED for `*`.** The calls above were made as a one-off research check; a production crawler honouring robots.txt must not call them.
5. **ToS** `https://www.hackerrank.com/about-us/terms-of-service`, section 6.1 Prohibited Uses (verified). No explicit "scrape/crawl/bot" word. Relevant: "(b) ... circumvent any security, access controls, or use limits of the Service"; "(e) copy, distribute, resell, publicly display, modify, reverse engineer, or create derivative works of any part of the Services"; "(h) use the Services for competitive analysis or for the development or provision of a competing service or product". A progress tracker could arguably fall under (e) or (h); this is interpretation, not a clear ban.
6. **Unknown handle.** `GET .../rest/contests/master/hackers/<nonexistent>/profile` returns `404 {"error":"Not Found"}`.
7. **Logged-in browser.** Unverified (needs login). Reported: submission list and code under `/rest/contests/master/submissions/...`; not tested.
8. **Open source** (reported, not tested): tashifkhan/hackerrank-stats-api (internal `/rest/hackers/...` JSON), animeshmisra2008/Hackerrank-Data-Scraper, BharatRathore/HackerRank-Badges, hackerrank-badges.github.io. All use internal `/rest/` JSON.
- **Verification field.** `short_bio` (public, free text, editable by the user) in the profile endpoint and in the profile HTML.
- **Best source:** `/rest/hackers/<h>/badges` (summed `solved`), but robots-disallowed. Without that, the extension route is the only compliant one.

---

## 4. InterviewBit

1. **Official API.** None found.
2. **Unofficial JSON** (found in Ashok-Bhatt/ScrapeSpidey `controllers/v2/interviewbit.controller.js`, **verified live** with the handle `kunal-bandooni` taken from a public GitHub README; 200, no auth; I sent a `Referer: https://www.interviewbit.com/` header):
   - `GET https://www.interviewbit.com/v2/profile/username?id=<h>` returns `{bio, follower_count, global_rank, university_rank, created_at, name, username, university, orgname, orgyear, city, country, job_title, linkedin, github, ...}`.
   - `GET https://www.interviewbit.com/v2/problem_list/problems_solved_overview_count?username=<h>` returns `{total_problems_solved: 575, course_problems_solved[], topic_problems_solved[] (per topic), difficulty_problems_solved[{difficulty_level, solved_problems_count, time_to_solve}], total_time_spent}`. Note the course counts overlap; use `total_problems_solved`.
   - `GET https://www.interviewbit.com/v2/profile/username/submission-analysis/?id=<h>` returns result-type counts (correct_answer, wrong_answer, ...).
   - `GET https://www.interviewbit.com/v2/profile/username/daily-user-submissions/<year>/?id=<h>` returns `[{date, count}]`, daily counts per year.
   - **No solved-problem list and no solve timestamps found.** No rating or contests.
3. **Profile HTML** `https://www.interviewbit.com/profile/<h>/` returns 200 but a Next.js error/shell page (`id="__next_error__"`, 33 KB) with no profile data, for both a real and a nonexistent handle. Not usable without JS, or the page is gated now. Old scrapers read a `.user-stats` div (rank, score, streak from ~2020); that no longer appears.
4. **robots.txt** (`www.interviewbit.com/robots.txt`): `User-agent: *` / `Disallow: /profile`. Sitemap only otherwise. **The profile HTML page `/profile/<h>` is disallowed.** The JSON endpoints live under `/v2/...`, which a literal robots.txt prefix match does NOT cover (`/profile` only matches paths starting with `/profile`). So technically allowed by the letter of robots.txt, but they serve the same data the disallowed page shows; flag this as letter versus spirit.
5. **ToS** `https://www.interviewbit.com/pages/terms/` (verified; operated by Scaler). Prohibited: "using any engine, software, tool, agent or other device or mechanism (such as spiders, robots etc.) to navigate or search the Platform"; "copying or duplicating in any manner any of the Scaler Content or other information available from the Platform"; "using or launching any automated system, including without limitation, 'robots,' 'spiders,' or 'offline readers,' that accesses the Platform in a manner that sends more request messages ... than a human can reasonably produce". **Automated navigation is prohibited**, with the rate-limit clause suggesting low-volume use is the concern.
6. **Unknown handle.** `GET /v2/profile/username?id=<nonexistent>` returns `403` with an empty body (text/html), also without a Referer. Not distinguishable from a block in theory, but the real handle gave 200 from the same client, so I read 403 as "not found".
7. **Logged-in browser.** Unverified (needs login). Reported: ragib06/ibitscraper downloads your own solutions with an email and password login; not tested.
8. **Open source.** ScrapeSpidey (the `/v2/` JSON above, verified to work); abhijeet-reddy/Competitive_Programming_Score_API (HTML scraping of `/profile/<h>`, last push 2023, now broken per my test). Stability unknown.
- **Verification field.** `bio` (null for the tested user; presumably editable text; not tested).
- **Best source:** `problems_solved_overview_count` (total and by difficulty, no list).

---

## 5. Code360 (Coding Ninjas / naukri.com/code360)

1. **Official API.** None found. The site is an Angular SPA calling `https://www.naukri.com/code360/api/` (base URL read from the production bundle) and legacy `https://api.codingninjas.com/api/`. The bug-bounty page lists `api.codingninjas.com` as in scope (reported, not opened).
2. **Unofficial JSON** (endpoint names from the public bundle `https://static.naukimg.com/code360/main.*.js`, and the working call confirmed in Ashok-Bhatt/ScrapeSpidey `code360.controller.js`; **verified live**):
   - `GET https://www.naukri.com/code360/api/v3/public_section/profile/user_details?uuid=<uuid>&request_differentiator=1&app_context=publicsection&naukri_request=true` returns 200 JSON, no auth. Fields: `profile.{name, summary}`, `about`, `profile_links` (linkedin, github), college, company, followers_count, `user_level_name`, `has_contest_rating`, and `dsa_domain_data.problem_count_data.{total_count, difficulty_data:[{level: Easy/Moderate/Hard/Ninja, count}]}` (273 total: 178/67/28/0 for the tested user), plus `dsa_domain_data.contest_ranks` and `badges_hash` (topic badges).
   - `GET .../v3/public_section/challenge/overall_leaderboard?date=YYYY-MM-DD&count=N` is public and returns names plus `uuid`, i.e. a source of valid ids. Do not use it for harvesting users.
   - Names in the bundle (not tested): `streaks/fetch_curr_and_long_streak`, `user_rating_data` (contest rating history, used by ScrapeSpidey), `profile/contributions` (heatmap).
   - `GET .../profile/view_solved_problems?uuid=<uuid>` returns `401 {"message":"User not found or unauthorized"}` unauthenticated. **The solved list needs login.** No timestamps or tags available publicly.
3. **Profile HTML.** `https://www.naukri.com/code360/...` always returns the same 21 KB SPA shell (client-rendered). **Nothing in the plain HTML.** The profile URL appears to be by uuid (the API takes `uuid`; exact page route `.../profile/<uuid>` is inferred, unverified).
4. **robots.txt.** The real file is `https://www.naukri.com/robots.txt` (`https://www.naukri.com/code360/robots.txt` just returns the SPA shell, ignore it). For `User-agent: *`: `Disallow: /advertiser/ /preview/ /photo/ /profilePic/ /gpw/ /jg/ ... /code360-staging /skill360 ...`. **No rule covers `/code360/profile` or `/code360/api/`**, so the user_details call is allowed. Separate group: the named AI bots (`claudebot`, `Claude-User`, `gptbot`, `ccbot`, `perplexitybot` etc.) get `Disallow: /` with `Allow: /code360/`. `codingninjas.com/robots.txt` is `Allow: /` with `Disallow: /admin`.
5. **ToS.** **Not determined.** `codingninjas.com/terms-and-conditions` and `naukri.com/termsconditions` are client-rendered (empty in plain fetch; WebFetch got 403). The bundle references a `terms_and_conditions` API I did not call. Treat as unknown; must be read manually in a browser before relying on this.
6. **Unknown handle.** `user_details?uuid=<garbage>` returns `404 {"data":null,"message":"Not found","status":404,"error":{"code":404,...}}`.
7. **Logged-in browser.** `view_solved_problems` (401 unauthenticated) is the likely solved-list call; the extension would need the user's session. Unverified (needs login).
8. **Open source.** Only ScrapeSpidey (axios on the JSON above). No dedicated Code360 stats library found (GitHub topic `code360` only has solution repos). So this is internal JSON with little community validation; the bundle shows it is the live production API.
- **Identifier problem.** The public key is a **uuid**, not a username. Users would paste their profile URL; we parse the uuid. Verify ownership via `about`/`profile.summary` (free text, user-editable) or `profile_links.github`.
- **Best source:** `user_details` for total and difficulty counts and contest ranks.

---

## Summary table

| Platform | Official API | Best public source for solved count | Solved list public? | Timestamps? | Tags/difficulty? | robots.txt verdict for that source | ToS verdict | Verification field | Recommended route |
|---|---|---|---|---|---|---|---|---|---|
| CodeChef | Portal dead (NXDOMAIN); `api.codechef.com` 401, OAuth by email request only | `/users/<h>` HTML: "Total Problems Solved: N" (verified) | Names only, grouped by contest; no ids | No | No | `/users/` allowed for `*` | Scraping explicitly banned (s.14 "spider, crawl, or scrape") | None seen; Institution/name unverified | Extension (user's own browser) for counts and list; server fetch conflicts with ToS even though robots.txt permits it |
| GFG | None | `authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=` (verified) | Yes, full list via `practiceapi.../problems/submissions/` POST (verified) | Yes (`user_subtime`) | Difficulty bucket only | No `/profile` rule; API hosts have no robots.txt | Bans bots/scripts/scrapers/data mining broadly | None free-text confirmed (designation/institute unverified) | Server count fetch is technically workable; ToS clause is the risk. Extension for the list (or the same POST from the user's browser) |
| HackerRank | None public (Work API is customer-only) | `/rest/hackers/<h>/badges` summed `solved` (verified) | No (recent_challenges only, not solved-only) | Daily counts; recent_challenges `created_at` | Per-domain only | **`/rest/` and `/profile/` DISALLOWED for `*`** | No explicit scrape clause; (e)/(h) arguable | `short_bio` (verified, public) | Extension only; do not fetch server-side |
| InterviewBit | None | `/v2/problem_list/problems_solved_overview_count?username=` (verified) | No (counts by topic/difficulty only) | Daily counts per year | Difficulty and topic counts | `/profile` page disallowed; `/v2/...` not matched by the literal rule | Bans spiders/robots navigating the Platform | `bio` (null on sample; editable presumed) | Server count fetch workable on `/v2/` but against the spirit of the robots rule and the ToS; extension preferred |
| Code360 | None | `/code360/api/v3/public_section/profile/user_details?uuid=` (verified) | No (needs login, 401) | No | Difficulty counts (Easy/Moderate/Hard/Ninja) | No rule on `/code360/api/` or profile for `*` | **Not determined** (pages client-rendered) | `about` / `profile.summary` | Server count fetch workable after reading the ToS manually; uuid-based, not username; extension for the list |

## Caveats and gaps
- All endpoints other than CodeChef's `/users/` page and robots.txt are undocumented internal APIs. They can change or start requiring tokens without notice; GFG's profile moved to Next.js App Router recently, and old scrapers broke.
- I tested one real handle per platform (CodeChef: gennady.korotkevich; GFG: nikhilpal2705; HackerRank: shashank21j; IB: kunal-bandooni; Code360: a uuid from the public POTD leaderboard). Behaviour for private profiles was not tested.
- Code360 ToS text, GFG/InterviewBit/CodeChef rate limits, IB profile HTML behaviour with JS, and all logged-in endpoints remain unverified.
- Samples (`samples-group1/`): robots files (`robots-*.txt`, `r-www.naukri.com_robots.txt`; ignore `r-www.naukri.com_code360_robots.txt`, it is the SPA shell), ToS pages (`tos-*.html`, Code360's were deleted because they were empty shells), and the API responses named by platform (`cc-`, `gfg-`, `hr-`, `ib-`, `c360-`).
