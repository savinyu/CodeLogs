# CodeLogs browser extension (LeetCode history)

Sends your full LeetCode solved list, with solve dates when possible, to your CodeLogs account.
LeetCode's public API only exposes your 20 most recent submissions; this extension reads the rest
from your own logged-in browser.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. In CodeLogs, go to **Settings -> Browser extension** and create a token (it starts with `cl_`).
4. Open the extension popup, enter your CodeLogs URL (default `http://localhost:3000`) and the token,
   and click **Save**. For a non-localhost https URL Chrome asks for permission to contact it.
5. Be logged in on leetcode.com, then click **Sync LeetCode history**.

## What it reads and sends

- Reads `https://leetcode.com/api/problems/all/` (solved list) with your browser session.
- Optionally reads `https://leetcode.com/api/submissions/` page by page, keeping only the problem
  slug, the status and the timestamp of each submission, to find the date of your first Accepted
  solution per problem. That response also contains your source code; it is never stored or sent.
- Sends to CodeLogs only: your LeetCode username, problem slugs and Accepted timestamps, with your
  CodeLogs token in an `Authorization` header.
- Never sends: LeetCode cookies, your LeetCode password, or any code.

## Politeness

One request at a time, at least 1.5 s between submission pages, a 10 s then 20 s back-off on HTTP
429/403 (then dates are skipped), and at most 400 pages.

## Caveats

The submissions endpoint is unofficial and undocumented; its format may change. If it fails, the
upload still happens without dates and the popup tells you. Running a sync again later is safe.
