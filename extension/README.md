# CodeLogs browser extension

Syncs your solved problems from **LeetCode, CodeChef, Code360, HackerRank, InterviewBit and
GeeksforGeeks** to your CodeLogs account. These sites don't share your full history publicly, so the
extension reads it from your own logged-in browser: once when you connect, then by itself while you
use those sites, and whenever you click **Sync**.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. A welcome tab opens (the popup's own page). Click **Connect to CodeLogs**. Chrome asks once for
   access to the platform sites (and CodeLogs itself, if your site-access setting withheld it);
   declining the platforms still connects, and each one asks again on its first Sync. A CodeLogs
   tab opens at `/extension/connect`: sign in there if it asks, and the extension links itself.
   There is no token to copy. The CodeLogs URL (default `https://codelogs.techsavy.space`) is under
   **Advanced**. The only other URL it accepts is `http://localhost` on any port, for a dev server,
   which is asked for in the same prompt.
4. It then syncs every platform once, opening a background tab for each of the five it has access to
   (closed afterwards). Platforms you aren't logged in to are skipped quietly.

## Publishing

Bump `version` in the manifest first (the store rejects a version it already has), then run
`pnpm extension:zip` at the repo root and upload `codelogs-extension.zip` (manifest at the top level,
no dotfiles or README) in the Chrome Web Store developer dashboard.

## Connecting

The connect tab's page carries `data-codelogs-connect="signed-out"` or `"ready"`. Once it says
"ready", the extension runs a small script in that tab that calls `POST /api/extension/connect` as a
same-origin request with the user's own CodeLogs session, plus an `X-CodeLogs-Extension: connect`
header (the route also checks `Origin`, so another site can't trigger it). CodeLogs answers with a
new token, named "Browser extension". The extension keeps it in `chrome.storage.local` and tells the
page (`codelogs:extension-connect` event, and the same result in `sessionStorage`). Only the tab the
extension opened is read, within 30 minutes. At the 5-token cap the least recently used "Browser
extension" token is replaced. Connect lists them under **Connected browsers**, where each can be
revoked; a revoked token disconnects the extension on its next request.

## Automatic sync

On by default; the **Sync automatically** switch in the popup turns it off.

- **On a visit:** when a page on a platform finishes loading (Code360: only under `/code360/`) and
  that platform's last sync is older than 6 hours, it syncs in **that tab**. It never opens a tab of
  its own for this. A logged-out or failed visit waits 10 minutes before trying again.
- **LeetCode daily:** an hourly alarm syncs LeetCode when its last sync is older than a day (no tab
  needed). Automatic LeetCode syncs read submission dates only back to a day before the last
  success; CodeLogs keeps the dates it already has.
- One sync at a time; an automatic one is skipped while another runs. Each row in the popup shows
  its last outcome.

For CodeChef, Code360, HackerRank, InterviewBit and GeeksforGeeks the first sync also connects the
handle in CodeLogs if you haven't added it, and verifies it: the account you are logged in to is the
proof that the handle is yours.

## How it reads these sites

The service worker never fetches CodeChef, Code360, HackerRank, InterviewBit or GeeksforGeeks
itself. It uses an open tab on the site (or opens one in the background and closes it afterwards) and
runs small functions inside that tab, so the requests are same-origin, like the site's own pages, and
use your own session. LeetCode is fetched from the service worker, as before.

Identity (who you are logged in as) is read by functions that return **one string only**: a username
or id. The responses they look at contain emails and access tokens; those never leave the page.

| Platform | Identity | Counts | Solved list | Calendar |
| --- | --- | --- | --- | --- |
| LeetCode | `/api/problems/all/` `user_name` | num_solved | same endpoint; dates from `/api/submissions/` (slug, status, time only) | - |
| CodeChef | `/api/user/me` username (fallbacks: `Drupal.settings.username`, header link) | "Total Problems Solved" on your profile page | `/recent/user` pages: accepted submissions, earliest per problem, India time | `userDailySubmissionsStats` on the profile page, if present |
| Code360 | `/code360/api/v2/users/auth_details`, the `uuid` field only | public `user_details` (`problem_count_data`) | `view_solved_problems` pages (coding problems only) | - |
| HackerRank | `/rest/contests/master/hackers/me` username (fallback: page state) | list size, else the sum of badge `solved` | `/rest/contests/master/submissions/` pages: accepted, earliest per challenge | `submission_histories` |
| InterviewBit | `window.__INTERVIEWBIT__.user.username` | `problems_solved_overview_count` | `/v2/problem_list/` pages, problems you solved (no dates) | `daily-user-submissions`, this and last year |
| GeeksforGeeks | `gfguserName` cookie (fallback: header profile link) | `user-profile-info` total | `problems/submissions/` (full list, India time) | - |

## What it sends

To CodeLogs only: the platform handle, problem ids, titles, URLs on the platform's own site,
difficulty labels, tags where the site gives them, solve dates, counts and daily activity, with your
extension's CodeLogs token in an `Authorization` header. It **never sends cookies, passwords, tokens from the
platforms, emails or your code**, and it doesn't request submission sources.

## Politeness

On connect, on a click, or at most every 6 hours per platform while you visit it (LeetCode: also
daily). One request at a time, at least 1.5 s apart. On HTTP 429 or 403 it waits 10 s, then
20 s, then stops with a message. Page caps per platform: CodeChef 400, HackerRank 200, InterviewBit
150, Code360 100, LeetCode submissions 400. Code360's login is checked again at the end, and
the upload is dropped if the account changed.

## Permissions

- `storage`: your CodeLogs URL, token, settings and theme; sync status and each platform's last run.
- `scripting`: runs the read functions inside the platform's tab, and the connect script in the
  CodeLogs tab.
- `alarms`: the hourly check for LeetCode's daily sync.
- Host access to `leetcode.com` and `codelogs.techsavy.space` (always). If you limit the
  extension's site access in Chrome (for example "On click"), Chrome withholds both; Connect and
  Sync ask for them again, and a sync without them says so instead of failing. CodeLogs' API sends
  no CORS headers, so without its host access neither connecting nor uploading works.
- Optional host access, asked when you click Connect (or on a platform's first Sync if declined),
  never at install: `www.codechef.com`, `www.naukri.com` (Code360), `www.hackerrank.com`,
  `www.interviewbit.com`, `www.geeksforgeeks.org`, and `localhost` when the CodeLogs URL is a dev
  server. No wildcard hosts: `tests/extension.test.ts` checks the manifest for them.

Privacy policy: <https://codelogs.techsavy.space/privacy> (`app/privacy/page.tsx`).

## Caveats

These are the sites' internal endpoints, not public APIs. They can change or start refusing
requests at any time, and some (identity on HackerRank, CodeChef and InterviewBit, InterviewBit's
`has_solved`) could only be written from documentation and open-source code, not from a logged-in
session. If a platform fails, the popup says which step; syncing again later is safe. A list is
marked complete only when every page was read (GeeksforGeeks and InterviewBit: when it matches the
platform's own count).
