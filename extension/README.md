# CodeLogs browser extension

Syncs your solved problems from **LeetCode, CodeChef, Code360, HackerRank, InterviewBit and
GeeksforGeeks** to your CodeLogs account. These sites don't share your full history publicly, so the
extension reads it from your own logged-in browser, only when you click **Sync**.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. In CodeLogs, go to **Connect** and create an extension token (it starts with `cl_`).
4. Open the extension popup, enter your CodeLogs URL (default `http://localhost:3000`) and the token,
   then click **Check connection**. For a non-localhost https URL Chrome asks for permission to
   contact it. Once it works, the Connection card collapses to "Connected as @you".
5. Be logged in to the platform in this browser, then click **Sync** on its row. The first time you
   sync a platform, Chrome asks to let CodeLogs access that site.

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
CodeLogs token in an `Authorization` header. It **never sends cookies, passwords, tokens from the
platforms, emails or your code**, and it doesn't request submission sources.

## Politeness

Only on a click. One request at a time, at least 1.5 s apart. On HTTP 429 or 403 it waits 10 s, then
20 s, then stops with a message. Page caps per platform: CodeChef 400, HackerRank 200, InterviewBit
150, Code360 100, LeetCode submissions 400. Code360's login is checked again at the end, and
the upload is dropped if the account changed.

## Permissions

- `storage`: your CodeLogs URL, token and theme; sync status.
- `scripting`: runs the read functions inside the platform's tab.
- Host access to `leetcode.com` (always) and `localhost:3000`.
- Optional host access, asked the first time you sync that platform (not at install):
  `www.codechef.com`, `www.naukri.com` (Code360), `www.hackerrank.com`, `www.interviewbit.com`,
  `www.geeksforgeeks.org`. A non-localhost CodeLogs URL is asked for when you save it.

## Caveats

These are the sites' internal endpoints, not public APIs. They can change or start refusing
requests at any time, and some (identity on HackerRank, CodeChef and InterviewBit, InterviewBit's
`has_solved`) could only be written from documentation and open-source code, not from a logged-in
session. If a platform fails, the popup says which step; syncing again later is safe. A list is
marked complete only when every page was read (GeeksforGeeks and InterviewBit: when it matches the
platform's own count).
