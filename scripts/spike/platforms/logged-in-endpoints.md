# Logged-in (same-origin) endpoints for the extension: group 1

Research date 2026-10-18. Context: `chrome.scripting.executeScript` runs a function inside a tab on the platform's own origin, so `fetch(url, {credentials: 'same-origin'})` carries the user's cookies like the site's own frontend. Public no-login endpoints are in `codolio-platforms.md`; this file covers only what a logged-in browser adds.

Confidence labels: **verified** = seen in a live response today (anonymous curl, UA `CodeLogsResearch/1.0`, 2 s+ apart, no cookies, no login); **from source** = read in open-source code (repo, file, last push date); **guess** = inferred, not seen anywhere.

Anonymous probes made (total 9): CodeChef 3 (`/api/user/profile/<h>`, `/api/submissions?...`, `/api/user/me`), InterviewBit 4 (`/v2/problem_list/` x3, `/practice/` page), Code360 2 (`auth_details`, `view_solved_problems`). None on robots-disallowed paths. HackerRank got zero probes because every `/rest/` path is disallowed.

Best find: **callmenixsh/crossDSA** (github.com/callmenixsh/crossDSA, Chrome MV3 extension, last push 2026-10-11, very active, tests included). It does exactly this job for Code360 (identity + solved history through same-origin fetches) and also reads CodeChef and GFG. Used as source below as "crossDSA".

Safety note for all five: logged-in identity responses contain PII or secrets (email, tokens). Read only the username/uuid field inside the page function and return just that; never return the whole response to the service worker.

---

## 1. CodeChef (www.codechef.com)

### Identity
- **`GET /api/user/me`** (same-origin, no params). **Verified logged out**: 200 JSON `{"status":"success","user":{"username":null,"uid":null,"email":null,"html_handle":null,"fullName":null,"rating":-1,"userRatingStar":"0","isPremiumUser":false,"country":null, ...},"time":...,"ip":"..."}`. Logged in, `user.username` is presumably the handle (not verified, needs login). Fields `email`, `uid`, `fullName`, `ip` are PII; return only `username`. Logged out = `username === null`. It is a site-frontend endpoint, not a documented API; not in robots.txt (no `/api` rule). Confidence: endpoint verified, logged-in value is a guess (strong, field name matches).
- **`Drupal.settings.username`** (JS global, MAIN world). In the profile HTML `jQuery.extend(Drupal.settings, {...})` **verified** to contain `"username":null` logged out, next to `"currentUser":"<profile owner>"`. Careful: `currentUser` is the profile being VIEWED (verified: `gennady.korotkevich` while anonymous), not the visitor. `username` is probably the visitor (guess). Prefer `/api/user/me`.
- DOM fallback (crossDSA, `tracker/platforms/solved-browser.js`, 2026-10-10): anchors in `header a[href], nav a[href]` matching `^/users/([^/]+)/?$`. Fallback only.

### Solved list
CodeChef has no logged-in solved-list JSON that I could find. Options, best first:
1. **`GET /recent/user?user_handle=<h>&page=<n>`** (page 0-based). From source: crossDSA `tracker/imports/history-import.mjs` + `platform-collectors.mjs` (2026-10-11); aropan/clist `src/ranking/management/modules/codechef.py` (2026-10-11); Alafazam/Codechef-analytics-tool (old). Response JSON `{content: "<html table>", max_page: N}`. Table columns: Time ("hh:mm AM 25/12/23", IST, +05:30), Problem (link `/problems/<CODE>` or `/<CONTEST>/problems/<CODE>`), Result (`title="accepted"` or the verdict, partial score as `(NN)`), Lang, Solution (link `/viewsolution/<id>`). Contains ALL submissions, not only AC: filter AC, dedupe by problem code, keep earliest AC time for "first solved". Has problem code + timestamp + submission id; no difficulty, no tags (join with `/api/list/problems/...` catalogue, public, has `difficulty_rating`). Page size not documented (~20 rows; l-amigo assumes 20, unverified). **Not session dependent** (scrapers call it anonymously), so the extension gains nothing from cookies here. **robots.txt disallows `/recent/user`** (see codolio file). Confidence: from source, multiple independent users, 2026.
2. `GET /api/submissions?username=<h>&page=<n>&language=&status=AC`: from source only, FTS18/l-amigo `src/services/codechef.ts` (pushed 2026-10-17, uses `credentials:'include'`, expects `{status, data.content[]}` with `problem_code, problem_name, time, language, submission_id`). The code tolerates "a couple of shapes", i.e. the author did not know the exact shape. **Anonymous curl got a Cloudflare 403 challenge page** (verified), so it needs a real browser. Treat as **guess** until tested inside a logged-in tab.
3. Profile HTML `/users/<h>` (verified): "Total Problems Solved: N" and solved problem NAMES grouped by contest/practice, no codes/times. Count check only.
- Stale/wrong: Jeeban-2006/DSA-Sync `app/api/import/codechef/route.ts` (2026-08) treats `content` as a JSON array of `{result:'AC',...}`; that contradicts clist/crossDSA (content is an HTML string). Do not copy.
- `GET /api/user/profile/<h>`: AI-Coding-Coach `reproduce_fetch.py` (2025-12) uses it; **anonymous probe returned 404 HTML**. Dead or removed. `api.codechef.com` OAuth API: 401, no self-service (see codolio file).

### Other
- **Rating history** (**verified**): `Drupal.settings.date_versus_rating.all[]` in profile HTML, 102 entries for the sample, keys `code, getyear, getmonth, getday, reason, penalised_in, rating, rank, name, end_date ("2023-02-08 22:30:00"), color`. Also `.all_old`, `.dsa_monday`. Parse with `/jQuery\.extend\(Drupal\.settings,\s*(\{.*?\})\);/s`. Same approach in FTS18/l-amigo and clist. Fetch `/users/<own handle>` same-origin; no login needed.
- **Heatmap**: `var userDailySubmissionsStats = [{date:'YYYY-MM-DD', value:N}, ...]` in profile HTML (crossDSA `parseCodeChefCalendar`, 2026-10-11). **Verified empty `[]` in my anonymous curl** of a famous profile, so the array may be filled client-side or only for browsers; test in-tab. Confidence: from source, partially contradicted.

---

## 2. Code360 / Coding Ninjas (www.naukri.com/code360)

All calls are same-origin `https://www.naukri.com/code360/api/...`, cookie auth, no custom header needed (crossDSA sends only `credentials:'same-origin'`).

### Identity (best-documented of all five)
- **`GET /code360/api/v2/users/auth_details?naukri_request=true`**. **Verified logged out**: 200 `{"data":{},"message":"User Not Authenticated","status":200,"error":null,...}`. Logged in (from source, crossDSA `tracker/platforms/code360-history-bridge.js` + test fixture, 2026-10-11): `data.uuid` (the public profile key), `data.screen_name` (vanity handle), plus `data.email` and `data.user_access_token` (SECRET: never read or return). Logged out check: `data.uuid` undefined. Profile route is `/code360/profile/<screen_name or uuid>` (crossDSA matches both).
- Also: the uuid is in the public `user_details` response as top-level `uuid` (verified in `c360-user-details.json` key list), so once the extension has the uuid it can call the public endpoint from the server.

### Solved list
- **`GET /code360/api/v3/public_section/profile/view_solved_problems?page=<n>&naukri_request=true`**. From source: crossDSA bridge (page param 1-based) and its parser `tracker/platforms/code360-history-parser.mjs`. **Verified**: logged out returns 401 (compressed body; earlier research saw `{"message":"User not found or unauthorized"}`). Response: `data.total_pages` (int), `data.problem_submissions[]` with `link` (e.g. `/code360/problems/two-sum_123`, older rows `www.codingninjas.com/studio/problems/...`), `problem_name`, `solved_at` (ISO 8601 with offset; some rows carry relative text like "2 hours ago" or null, treat as undated). Rows can include other fields crossDSA discards (it mentions `code` in a test, i.e. private data), so slice fields explicitly. Max rows per page asserted <= 1000 in crossDSA; real page size unknown. **No difficulty/tags in the fields crossDSA reads**; a difficulty total comes from public `user_details` (Easy/Moderate/Hard/Ninja counts only). Also includes MCQ/non-coding rows; crossDSA filters links with `^/code360/problems/[a-zA-Z0-9_-]+/?$`. Problem id = slug suffix after `_` in the link.
- **POTD status** `GET v3/public_section/potd/problem_list?date=YYYY-MM-DD&naukri_request=true` (crossDSA): `data.details.{EASY,MODERATE,HARD,NINJA}.problem` with `user_score`/`max_score`, `evaluated`. Useful for "did I do today's POTD".
- Rate/politeness: crossDSA makes identity call before and after the list call to detect account switches mid-sync. Worth copying.

### Other
- Contest rating history, streak, contributions heatmap: names only (`user_rating_data`, `streaks/fetch_curr_and_long_streak`, `profile/contributions`), see codolio file; not tested.

---

## 3. HackerRank (www.hackerrank.com)

**Every `/rest/` path is robots.txt-disallowed** (and `/profile/`), so I made no probes; everything below is from source. All are the site's own XHRs; the site's frontend also sends `x-csrf-token`, but GET requests work with just the session cookie in all sources (`_hrank_session`, HttpOnly: unreadable from page JS and not needed, cookies ride along automatically).

### Identity
- **`GET /rest/contests/master/hackers/me`**: from source only, DhiWise/HackerRankMobileApp `lib/data/apiClient/api_client.dart` (**stale, last push 2022-10**). Likely returns `{model:{username,...}}` (same shape as the verified `/hackers/<h>/profile`). Confidence: **guess** (stale but plausibly still live; `me` aliases are common on this backend). Logged out: unknown (probably 401/403).
- **Page-embedded**: `<script id="initialData">` holds URL-encoded JSON (redux state; `decodeURIComponent` then `JSON.parse`; **verified** on anonymous profile page). Top-level keys `app, metadata, community, work, sourcing, abtest, featureFeedback, api`. `community.profile` is the visitor's own profile slice (empty `{contestHistory:{list:[],total:0}, badges:[], ...}` logged out, **verified**); `community.viewProfiles["<handle>"]` is the VIEWED profile (verified, had `username`). `metadata.session` verified as `{hasLegacyAccessToken:false, hasJwtAccessToken:false, hasJwtRefreshToken:false}` logged out (flags only, no tokens, safe to read). Whether `community.profile.username` is filled when logged in: **guess**. Run from any hackerrank.com page via `world:'MAIN'` or parse the DOM script tag.
- DOM fallback: header menu anchor `/profile/<username>`.

### Solved list
- **`GET /rest/contests/master/submissions/?offset=<n>&limit=<k>`** (own submissions, cookie auth). From source: yashhh-23/Leetcode-submissions `scripts/sync_hackerrank.py` (2026-10-08; uses limit 50, stops when `len(models) < limit`), AshokSirugudi/HackerRank-Solutions `sync_HR_portfolio.py` (2025-06; limit 10, reads `data.total`), yashh1994/Codeisyou (2025-08; `limit=100000` works but do not copy). Response: `{models:[...], total:N}`; each model: `id`, `status` ("Accepted" etc.), `language`, `score`, `challenge_id`, `challenge:{name, slug}`, `created_at` (unix seconds) or `submitted_at`. Newest first and it lists ALL submissions: build solved set = challenges having any `status === "Accepted"`, first-solved time = min `created_at` among those. Has ids, titles, timestamps; **no difficulty**. `GET /rest/contests/master/submissions/<id>` returns the code (do not fetch; not needed).
- **Difficulty / solved flag source**: `GET /rest/contests/master/tracks/<track>/challenges?offset=0&limit=1000&filters[subdomains][]=<subdomain>&track_login=true` returns models with `name, slug, difficulty_name, solved` (bool, only meaningful logged in). From source: mxdzi/hackerrank `generate_challenges_list.py` (2025-05, reads `challenge.get("solved")`), INSAlgo/maurice (2020, stale). Tracks: `algorithms`, `data-structures`, `mathematics`, `ai`, `sql`, ... one call per subdomain; heavy, so use only to enrich difficulty.
- Public (verified earlier): `/rest/hackers/<h>/badges` (sum of `solved`), `submission_histories`, `recent_challenges`; with a session the own-handle versions return the same.

### Other
- Rating/contest history: `/rest/hackers/<h>/scores_elo` (from source, Codeisyou, 2025-08). Daily heatmap: `/rest/hackers/<h>/submission_histories` (verified).

---

## 4. InterviewBit (www.interviewbit.com)

### Identity
- **`window.__INTERVIEWBIT__.user.username`** (page global, set by an inline `<script>`; read via `world:'MAIN'`). **Verified** on the anonymous `/practice/` page: `user:{"userId":null,"name":null,"email":null,"username":null,"score":null,"coins":null,"streak":null,"orgname":null,...}`, so logged out = `username === null`. Logged in the same keys are filled; **email/name are PII, return only `username`**. The same object is assigned in several inline scripts (`...window.__INTERVIEWBIT__` spread merges), so read the final merged value after page load. Confidence: shape verified, logged-in value a guess (strong).
- Same page also embeds `practice_data.leaderboard.{rank,name,score,username}` for the visitor (verified null logged out).
- Also: inline `window.Interviewbit.captureUserDetails({loggedIn:false,...})` on the page shows `loggedIn` (verified false logged out).

### Solved list
- **`GET /v2/problem_list/?page_offset=<n>&page_limit=20`**. **Verified anonymous 200** (not robots-disallowed; unlike `/profile`). Response `{items:[...]}`; each item (verified keys): `id, problem_statement, slug, difficulty_level ("easy"|"medium"|"hard"), score, average_solving_time, solved_by, topic_title, tag_names, tags[], has_solved`. Anonymous: `has_solved:false` on all 20 rows (verified), so logged in this flag marks the user's solved problems (**guess**, strongly implied by the field name; the sample CQ-Scrapping `4. interviewbit_scraper.py` 2024-03 uses this URL only for the catalogue). Paging quirks (**verified**): `page_limit` is capped at 20 (asked 1000, got 20); `page_offset` is an ITEM offset (offset=1 returned ids 2..21), so advance by 20. Stop when `items` is empty. Gives ids, titles, difficulty, topic, `has_solved`; **no solve timestamps**.
- Counts cross-check (public, verified earlier): `/v2/problem_list/problems_solved_overview_count?username=<h>`; daily activity `/v2/profile/username/daily-user-submissions/<year>/?id=<h>` (public, daily counts, the only timestamp-like data); streak `/v2/profile/username/streak/?id=<h>` (from source: vigneshvaranasi/trackcode-api, 2025-09).
- Nothing found for a per-problem "solved at" time. Nothing in open source for logged-in IB (no maintained GitHub-sync extension found; ragib06/ibitscraper is a password-login scraper, old).

---

## 5. GeeksforGeeks (www.geeksforgeeks.org)

### Identity
- **Cookie `gfguserName`**: from source, Saurabh825/gfg-cli (`cmd/config.go`, `internal/api/api.go`, pushed 2026-03-26: user is told to copy their `gfguserName` cookie value; sent as `Cookie: ...; gfguserName=<handle>`) and theanuragshukla/gfg_potd_solver (2024-05, same cookie next to `authtoken`/`gfg_nluid`). Value is the profile handle, i.e. not an auth secret by itself, but it sits in the same jar as `authtoken`/`sessionid`. Read ONLY this cookie: in the page `document.cookie.match(/(?:^|;\s*)gfguserName=([^;]+)/)` (works only if the cookie is not HttpOnly; unverified) or, more robust, `chrome.cookies.get({url:'https://www.geeksforgeeks.org', name:'gfguserName'})` from the service worker (needs `cookies` permission + host permission). Logged out: cookie absent (guess). Confidence: from source, I could not verify HttpOnly status.
- DOM fallback (crossDSA): header/nav anchors matching `^/profile/([^/]+)/?$`.
- No `/me`-style JSON endpoint found for GFG (searched; authapi `user-profile-info` requires `handle`).

### Solved list
Already public by handle (verified, see codolio file): `POST https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/` body `{"handle":"<h>","requestType":"","year":"","month":""}`, buckets `school|Basic|Easy|Medium|Hard` mapping `<problemId>` to `{slug, pname, lang, user_subtime}`; and `GET https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=<h>&article_count=false&redirect=true`. Corroborated by crossDSA `geeksforgeeks()` (2026-10-11, notes that `user_subtime` has day precision it trusts and noon-UTC placeholders) and tashifkhan/GFG-Stats-API (pushed 2026-09-03, "heatmap = count `user_subtime` per day", no native calendar endpoint). So the session adds only identity; just call the POST with the cookie-derived handle, from the page (same-site, Origin/Referer match automatically). Per-problem tags: `GET practiceapi.geeksforgeeks.org/api/v1/problems/<slug>/` -> `results.tags.topic_tags` (from source, GFG-Stats-API).
- GFG logged-in-only endpoints seen in source (not needed): `practiceapi.../api/latest/problems/<slug>/metainfo/` and `.../submit/compile/` (gfg-cli, gfg_potd_solver).

---

## Summary table

| Platform | Identity source | Solved-list source | Has ids | Has timestamps | Has difficulty | Confidence |
|---|---|---|---|---|---|---|
| CodeChef | `GET /api/user/me` -> `user.username` (null logged out, verified); fallback `Drupal.settings.username` | `GET /recent/user?user_handle=&page=` (HTML table in JSON; all submissions, filter AC; robots-disallowed; does not need cookies); counts from `/users/<h>` HTML | Yes (problem code, submission id) | Yes (IST minute precision) | No (join public `/api/list/problems`) | Identity: endpoint verified, logged-in value guess. List: from source (crossDSA, clist, 2026) |
| Code360 | `GET /code360/api/v2/users/auth_details?naukri_request=true` -> `data.uuid`, `data.screen_name` (logged out: `data:{}`, verified) | `GET /code360/api/v3/public_section/profile/view_solved_problems?page=N` (401 logged out, verified) -> `problem_submissions[]`, `total_pages` | Yes (problem link/slug) | Yes (ISO `solved_at`, some rows undated) | No (only public Easy/Moderate/Hard/Ninja totals) | High: from source, crossDSA 2026-10-11 + logged-out behaviour verified |
| HackerRank | Guess: `GET /rest/contests/master/hackers/me`; or `initialData` redux `community.profile.username`; DOM `/profile/<u>` link | `GET /rest/contests/master/submissions/?offset=&limit=50` (all submissions, filter `status==="Accepted"`); difficulty via `/rest/contests/master/tracks/<t>/challenges?...` | Yes (`challenge_id`, slug, submission id) | Yes (`created_at` unix s) | Only via track catalogue join | List: medium-high (from source, 2025-2026). Identity: low (guess). All `/rest/` robots-disallowed, 0 probes |
| InterviewBit | `window.__INTERVIEWBIT__.user.username` (null logged out, verified; email also in object, do not return) | `GET /v2/problem_list/?page_offset=N&page_limit=20` -> `items[].has_solved` (shape + logged-out `false` verified; offset is item-based, limit capped at 20) | Yes (`id`, `slug`) | No | Yes (`difficulty_level`, `topic_title`, `tags`) | Identity: shape verified, value guess. List: shape verified, logged-in `has_solved=true` is a strong guess |
| GFG | cookie `gfguserName` (via `chrome.cookies` or `document.cookie`); DOM `/profile/<h>` fallback | Public `POST practiceapi/.../user/problems/submissions/` with that handle (verified earlier) | Yes (problem id, slug) | Yes (`user_subtime`, day-level in practice) | Bucket only (School/Basic/Easy/Medium/Hard) | Identity: from source (gfg-cli 2026-03), HttpOnly status unknown. List: verified |
