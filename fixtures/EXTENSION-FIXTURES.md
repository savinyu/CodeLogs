# Fixtures for the extension readers

Real responses (trimmed, public data only, no personal fields):

- `gfg/submissions-sample.json`: real `problems/submissions/` entries, trimmed. The `School` bucket entry is synthetic.
- `gfg/user-profile-info.json`: only `total_problems_solved` (edited to 7, matching the trimmed list) and `score`.
- `gfg/user-profile-info-unknown.json`: real unknown-handle response.
- `hackerrank/badges.json`, `hackerrank/submission-histories.json`: real, trimmed.
- `interviewbit/overview-count.json`, `interviewbit/daily-submissions.json`: real, trimmed.
- `code360/user-details.json`: real `dsa_domain_data`; the `uuid` is a placeholder.
- `code360/auth-details-logged-out.json`, `code360/solved-unauthorized.json`: real logged-out responses.
- `codechef/profile-empty-heatmap.html`: excerpt of a real profile page (count line and the empty heatmap script).

Synthetic (written from the documented shapes in `scripts/spike/platforms/logged-in-endpoints.md`, because they need a logged-in account):

- `codechef/recent-user-page0.json`, `recent-user-page1.json`, `recent-user-empty.json`: the `/recent/user` HTML table (columns Time, Problem, Result, Lang, Solution).
- `codechef/profile-with-heatmap.html`: a populated `userDailySubmissionsStats`.
- `codechef/api-user-me-logged-out.json`: the documented logged-out `/api/user/me` shape.
- `hackerrank/hackers-me.json`, `hackerrank/submissions-page1.json`: `/hackers/me` and the submissions list.
- `interviewbit/problem-list-page.json`, `problem-list-page-logged-out.json`: item keys are verified; `has_solved: true` is the logged-in guess.
- `code360/solved-problems-page1.json`, `solved-problems-page2.json`: `view_solved_problems`.
- `gfg/submissions-unknown-user.json`: the documented 406 body.
