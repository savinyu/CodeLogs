# CodeLogs v2: Interface Plan

> Written 17 Oct 2026. The design source is the finalised claude.ai artifact **CodeLogs Coach 2** (https://claude.ai/artifact/NP8s1JJ6yxysjsuPbJBfVP). Read only that draft; the older ones are superseded. Progress is tracked in §8.

v2 rebuilds the whole interface around Coach 2: a pill-nav app with **Today, Progress, Topics, Sheets, Friends and Contests**, plus a visitor view of `/u/[username]`. The data layer from v1 (adapters, sync, scoring, recommendations, sheets) stays. PLAN.md remains the record of v1 and of every §4 decision, and those decisions still hold.

## 1. Decisions (owner, 17 Oct 2026)
- **Branches:** `v2` was cut from `main` at PR #25 and is the GitHub default branch. `main` stays as v1 and is not changed. Each milestone is a `v2-*` branch with a PR into `v2`. The captain merges a PR into `v2` once CI and review pass. A branch can't be named `v2/…` because `v2` exists.
- **Friends** are in scope: mutual friend requests, a weekly friends board, and an opt-in global board.
- **Leaderboards are difficulty-weighted.** A solve earns points equal to its difficulty band (Band 1 = 1 … Band 5 = 5). An unrated solve earns 1. Boards rank by points, then solves, then active days.
- **Sheets:** follow and unfollow sheets, manual "Solved it" ticks (they count only inside sheets, never in totals, topics or boards), and **Striver's SDE sheet** as a hand-made list of its LeetCode problems. Its non-LeetCode problems are listed but not counted. *Built 18 Oct 2026 as **Striver's 180**:* takeuforward no longer serves the 191-problem SDE day list, and the old SDE sheet URL now redirects to Striver's 180 (179 items in 17 sections), so that is the sheet. `pnpm sheets:striver` reads the list from the page's embedded data (dev-only; robots.txt allows the page) into `lib/sheets/striver-data.ts`, checking every slug against our LeetCode catalog: 144 LeetCode problems are tracked, 33 takeUforward problems (and two LeetCode discuss-post links) are listed only, and two items that share a LeetCode problem count once.
- **Today:** a daily goal (default 3, changeable in Settings, from 1 to 20) counts the UTC day's activity plus the picks marked done that haven't synced yet (owner feedback, 17 Oct 2026). "Mark done" is saved per day in the DB, and a synced solve today ticks its pick on its own.
- **Follow Coach 2 where it differs from v1:** the raw "Platform tags" charts and the v1 topic bar chart are replaced by the topic map. Charts become small server-rendered SVGs, so Recharts is removed. The "Sample data" pill and the draft notes strip are mockup-only and are not built.
- **Kept from v1 even though the draft doesn't show it:** "Sync now" (Connect, and on Progress) and colored difficulty text (M4 owner feedback). The activity period has no "All time": the owner removed it in PR #5, and v2 keeps it out.

## 2. Design system
**Fonts:** Bricolage Grotesque for display (`font-display`: page titles, card titles, big numbers) and Figtree for UI (`font-sans`), both through `next/font/google`. Geist is removed.

**Tokens:** `app/globals.css` maps Coach's palette onto shadcn's tokens, so the generated components restyle without edits, and it adds Coach's extra tokens. Light values are in `:root` and dark values in `.dark` (next-themes class strategy, as before). Components use tokens only, never hex.

| Coach | Token (utility) | Use |
|---|---|---|
| bg | `--background` (`bg-background`) | page |
| surface | `--card` (`bg-card`) | cards |
| surface-2 | `--muted`, `--secondary`, `--accent` (`bg-muted`) | tracks, chips, hover |
| surface-3 | `--raised` (`bg-raised`) | rows and tiles inside a card, popovers |
| fg / fg-muted | `--foreground` / `--muted-foreground` | text |
| grid | `--border` | dividers, chart grid |
| accent | `--primary` (+ `--primary-foreground`) | brand rose: active nav pill, primary buttons, weak |
| accent-soft / accent-ink | `--primary-soft` / `--primary-ink` | rose chips, rose text on soft |
| good / good-soft | `--good` / `--good-soft` | strong, done, verified |
| track / track-soft | `--track` / `--track-soft` | on-track, sheet chips |
| cf / ac / lc | `--platform-*` (kept names) | platform dots, chart series |
| heat-0…4 | `--heat-*` (kept names) | heatmap, week strip |
| cov-1…5 (+fg) | `--cov-*`, `--cov-*-fg` | owner topic map, by coverage |
| pub-1…4 (+fg) | `--pub-*`, `--pub-*-fg` | public topic map, by solves |
| (flame) | `--streak` = the rose | header streak |

**Shape:** cards are `rounded-card` (20px) with `p-6`; large cards are `rounded-card-lg` (24px) with `p-7`. Rows inside cards are `rounded-item` (18px) or `rounded-row` (14px). Buttons, chips and segments are pills. Cards have no borders: surfaces separate by tone. The shadow token `--shadow-pop` is only for popovers and the drawer.

**Buttons:** `components/ui/button.tsx` variants are re-cut to Coach's pill buttons (`default` = rose, `secondary` = surface-2, `ghost`, `outline`, `destructive`; sizes `sm`/`default`/`lg`/`icon`). This is the one hand edit to a generated component, and it is deliberate.

## 3. App shell and routes
**Header** (`components/shell/`): the brand mark, then the pill nav (centered; on phones it drops to its own row and scrolls sideways), then on the right the theme cycle button (system → light → dark), the streak pill (flame and days; rose once today has activity, grey while it waits; links to Progress) and the avatar. The avatar opens the **profile panel**: a welcome line, the Public profile switch, the Global leaderboard switch (disabled until the profile is public), "View my public profile", Connect, Settings and Sign out. Signed out, the header shows the brand, the theme button and "Sign in". On `/u/[username]` a visitor sees the profile URL pill in place of the nav.

| Route | Who | Search params | Built in |
|---|---|---|---|
| `/` | everyone | | V8 (landing restyle; signed-in users get "Open Today") |
| `/today` | owner | | V3 |
| `/progress` | owner | `platform`, `year` | V2 |
| `/topics` | owner | `topic` (opens the drawer) | V4 |
| `/sheets` | owner | `sheet`, `sections=weak` | V5 |
| `/friends` | owner | `board=friends\|global` | V6 |
| `/contests` | owner | | V7 |
| `/u/[username]` | public | | V9 |
| `/connect`, `/settings` | owner | | V8 (restyle; Settings gains the daily goal) |
| `/dashboard` | | | redirects (308) to `/today` in `next.config.ts` |

`proxy.ts` covers every owner route. Filters and toggles are links that change search params (server-rendered, no client state), except the topic drawer, which switches topics on the client and keeps `?topic=` in sync with `history.replaceState`.

## 4. Code structure
```
components/kit/        design primitives, no data access:
  panel.tsx            Panel (md | lg) + PanelHeader (title, info, action)
  page-head.tsx        PageHead (h1 + description)
  chip.tsx             Chip (neutral | primary | good | track | caps)
  bar.tsx              Bar (value 0–1, tone weak|ontrack|strong|neutral, optional expected marker)
  meter.tsx            Meter (name, chip, Bar, sub line)
  ring.tsx             Ring (progress ring with a centered label)
  stat-tile.tsx        StatTile (default | primary)
  segmented-links.tsx  SegmentedLinks (link pills with aria-current)
  disclosure.tsx       Disclosure (<details> with a chevron summary)
  note.tsx             Note (info strip)
  platform-dot.tsx     PlatformDot
  flame.tsx            Flame icon (lit | unlit)
components/shell/      site-header, main-nav (client: active pill), profile-menu + profile-panel, header-streak, theme-toggle
components/charts/     stacked-columns.tsx, heatmap.tsx, rating-line.tsx (SVG, server-renderable)
components/<page>/     today/, progress/, topics/, sheets/, friends/, contests/, profile/
app/<route>/           page.tsx (data + layout only), actions.ts (server actions); user preferences live in app/settings/actions.ts
lib/today/             set.ts, week.ts (pure)
lib/topics/            treemap.ts, view.ts (pure), plus the v1 files
lib/friends/           points.ts, week.ts (pure), queries.ts, actions helpers (server-only)
lib/sheets/            + striver-data.ts, follow.ts (pure); queries.ts gains getSheetState
lib/user-settings.ts   publicProfile, globalBoard, dailyGoal (server-only)
lib/streak.ts          current streak for the header (server-only)
```
Rules: pages fetch and lay out; components receive plain props; anything computable is a pure, tested function in `lib/`. A component is shared through `components/kit` or `components/charts` the moment a second page needs it, never copied. Keep the CLAUDE.md rules (Suspense around session reads, `userId` scoping, `getCurrentUser()` in every action).

## 5. Data model additions (migration `0007_v2`, written in V1)
```
users            + daily_goal smallint not null default 3 (check 1–20)
                 + global_board boolean not null default false
daily_marks      (user_id, day date, platform, external_id, created_at)   pk(user_id, day, platform, external_id)
sheet_follows    (user_id, sheet_id, following bool, updated_at)          pk(user_id, sheet_id)
sheet_ticks      (user_id, slug, created_at)                              pk(user_id, slug)
friendships      (requester_id, addressee_id, status pending|accepted, created_at, accepted_at)
                 pk(requester_id, addressee_id); unique(least, greatest); check requester <> addressee
```
- Every new table cascades from `users.id`, so account delete keeps working, and each one joins the JSON export (V8).
- `sheet_follows` stores explicit choices only. With no row a sheet isn't followed, so new users start with none (owner, 18 Oct 2026; NeetCode 150 was the default before) (`lib/sheets/follow.ts`).
- `sheet_ticks` is keyed by LeetCode slug, so one tick counts in every sheet that has the problem.
- A declined or cancelled request, or a removed friend, deletes the row. The other person isn't told.
- Boards count **verified handles only** (as on public profiles), so a borrowed handle can't climb a board. The week runs Monday 00:00 UTC to now.

## 6. Feature notes per page
- **Today:** the hero shows the local date and greeting (a small client component) and "N problems from your three weakest topics". **Today's set** has up to 5 picks: the first pick of each practice topic, then the weakest topic's second pick, then one "may already be solved" LeetCode pick, with duplicates removed (`lib/today/set.ts`). Each pick shows the platform, difficulty, a sheet chip when a followed sheet contains it, "Trains: Topic · focus", Mark done and Open. To keep the set stable through the day, `getSolveNext` takes `{ keepSolvedSince }` and excludes only solves from before today (UTC); a pick solved today comes back with `solvedToday` and shows as done. The goal ring sits in the card head. The side column has **This week** (7 day columns), **Why these** (coverage meters with an info tip) and **Your sheet** (the first followed sheet, and the next 2 problems in the section that trains your weakest topic).
- **Progress:** the platform filter, stat tiles (total plus one per platform with a status chip, CF rating or the LC E/M/H split), the sync line with Sync now, Active days beside the heatmap (period segments), **Solves per month** (new, last 12 months) and **Difficulty** as stacked SVG columns, and Recent solves.
- **Topics:** a squarified treemap. Tile area is the expected count, color is the coverage step (`cov-1…5`: under 50 %, 50–80, 80–100, 100–120, over 120), and weak tiles get a "Weak" tag. A tile opens a right-hand `<dialog>` drawer with prev/next and Esc. The drawer shows coverage, a state chip, the per-platform split, "solve about N more to leave the weak list", sub-topic bars with an expected marker (focus or lowest chip), practice picks, and the sheet sections that train the topic. Under 640 px the map becomes a list of tiles.
- **Sheets:** one card per sheet (progress, note, Follow/Following), then the selected sheet in detail: a ring, "N solved · N left · N sections train your weak topics", segments for All sections and Weak topics, and collapsible sections (each with its topic chip) listing unsolved problems with a "Solved it" tick. Each sheet section maps to a macro topic (`topic` on the section). Striver's off-LeetCode problems are listed in their section as untracked. The honest note about LeetCode's 20 recent solves stays.
- **Friends:** a weekly board (Friends or Global segments; rank, avatar, name, @username, active days, a platform split bar, points with solves under them; your row is outlined; Global shows the top 10, then a gap and your rank when you're listed) and a friends card (add by username, incoming requests with Accept and Decline, sent requests as Pending, your friends list with Remove). An info tip explains the points. `/u/[username]` gets "Add friend" for signed-in visitors.
- **Contests:** one card per platform (CF, LC): a rating line, stats (contests, best rank, current, max, LC global rank and top %), and a collapsed contest history list with rating deltas. The AtCoder note, and the LeetCode badges grid (real icons).
- **Public profile:** an owner banner when you view your own page, the hero (large avatar, name, @username · solving since, social link pills, verified handle chips), tiles (total, then solved per verified platform with solves: CF rating and max, LC contest rating and Easy/Medium/Hard), Active days and the heatmap (last 12 months, no filter), the public topic map (area and green step by solves; no expected or weak values), contest cards, badges, recently solved (6), and a sign-in CTA for signed-out visitors. The OG image moves to the v2 palette and fonts.

## 7. Milestones
Legend as in PLAN.md: 🧭 captain (Opus), 🤖 Sonnet 5.5 subagent with a precise spec, ∥ runs in parallel. Parallel subagents each work in their own git worktree. Subagents don't commit; the captain reviews, runs `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`, commits, opens the PR into `v2`, and merges it once CI is green.

### V0: Setup (`v2-plan`)
- 🧭 `v2` branch as the default, CI on pushes to `v2`, this plan, CLAUDE.md pointers

### V1: Foundation (`v2-foundation`)
- 🧭 Fonts and tokens (`globals.css`, `layout.tsx`), button variants
- 🧭 Schema and migration `0007_v2` (the new user columns are read with `lib/user-settings.ts`, not through Better Auth)
- 🧭 Sheets contract: `topic` on every section, `sheetProgress(sheet, solved, ticked)` with a per-problem `status` (`synced | ticked | null`), `sectionsTraining`, `sheetNamesBySlug`, `lib/sheets/follow.ts`, `getSheetState(userId)` in `lib/sheets/queries.ts`
- 🧭 Routes: stub pages for the new routes, `/dashboard` redirect, `proxy.ts` matcher, `lib/streak.ts`
- 🧭 Dev tools for visual checks: `pnpm dev:preview create` (a throwaway signed-in user cloned from the owner's data; `delete <user>` removes it) and `pnpm dev:shot <url> <png> [--width] [--dark] [--cookie]` (headless Chrome; reports horizontal overflow)
- 🤖∥ `components/kit/*` primitives (§4), ported from Coach 2's CSS
- 🤖∥ `components/shell/*`: header, pill nav, profile panel (with the global-board switch action), header streak, theme cycle
- **Done when:** every route renders inside the new shell in light and dark at 1280 and 360 px, the migration is applied, and the checks pass.

### V2–V7: Pages (all ∥ after V1)
- 🤖 **V2 Progress** (`v2-progress`): `components/charts/{stacked-columns,heatmap}.tsx`, `lib/dashboard/monthly.ts` (tested), `components/progress/*`, `app/progress`
- 🤖 **V3 Today** (`v2-today`): `lib/today/*` (tested), the `getSolveNext` `keepSolvedSince` option, `daily_marks` actions with optimistic Mark done, `components/today/*`, `app/today`
- 🤖 **V4 Topics** (`v2-topics`): `lib/topics/{treemap,view}.ts` (tested), `components/topics/*` (owner map, public map, drawer), `app/topics`
- 🤖 **V5 Sheets** (`v2-sheets`): `lib/sheets/striver-data.ts` (each slug checked against our LC catalog), follow and tick actions, `components/sheets/*`, `app/sheets`
- 🤖 **V6 Friends** (`v2-friends`): `lib/friends/*` (points and week tested), request, accept, decline, cancel and remove actions with limits (20 pending sent), board queries, `components/friends/*` (including `AddFriendButton`), `app/friends`
- 🤖 **V7 Contests** (`v2-contests`): `components/charts/rating-line.tsx`, `components/contests/*` (contest card, badges grid), `app/contests`
- **Done when (each):** the page matches Coach 2 with real data, works at 360 px with no horizontal scroll, has keyboard and screen-reader labels as in the draft, and the checks pass.

### V8: Connect, Settings, landing (`v2-account`) ∥ V9
- 🤖 Restyle `/connect`, `/settings` and `/` with the kit. Settings gets the daily-goal field. The export adds the new tables.

### V9: Public profile (`v2-public`) ∥ V8
- 🤖 `components/profile/*`, `/u/[username]` rebuilt from the V2/V4/V6/V7 components, OG image restyle

### V10: Cleanup and ship (`v2-cleanup`)
- 🧭 Delete v1-only components (`components/dashboard/*` leftovers, tag charts, topic bar chart, `components/ui/chart.tsx`), the `tags` part of the view model and its catalog query if nothing uses it, and Recharts. Update README screenshots, CLAUDE.md layout and this plan.
- 🧭 Full pass in headless Chrome (light/dark, 1280/360, signed out, owner, visitor) against the owner's data
- **Done when:** nothing imports a deleted file, the bundle has no Recharts, and the owner signs off on `v2`.

## 8. Progress
- [x] V0 setup: `v2` is the default branch, the plan is in (PR #26, 17 Oct 2026)
- [x] V1 foundation: tokens, fonts, kit, shell, migration `0007_v2` (applied to Neon), sheets contract, routes, preview and screenshot tools (PR #27)
- [x] V7 Contests (PR #28) · V5 Sheets: follow and manual ticks; Striver blocked, see §1 (PR #29) · V2 Progress (PR #30) · V4 Topics (PR #31) · V6 Friends (PR #32) · V3 Today (PR #33)
- [x] V9 public profile (PR #34) · V8 Connect, Settings (daily goal), landing, export (PR #35)
- [x] V10 cleanup: v1 dashboard components, unused shadcn components, Recharts, the raw platform-tag pipeline (two queries) and `SocialLinksRow` removed; README and CLAUDE.md updated
- Verified per PR: typecheck, lint, prettier, tests (373), CI green, and headless Chrome screenshots against a preview copy of the owner's data at 1280 and 360 px, light and dark
- Known limits: the dev:shot tool can't click, so Mark done, Solved it, Follow, the daily goal save and the friend actions were checked by their agents through headless Chrome scripts or not at all (noted in each PR). The LeetCode contest card's populated state (top %, badge, global rank) wasn't seen with real data, because the owner has no LeetCode contests and the preview clones keep LeetCode unverified on the public page
- [x] Owner feedback after the click-through: Mark done moves the daily goal (optimistic); visited pages stay in the client router for 5 minutes (`staleTimes.dynamic`), and Progress polls while a sync runs; Today loads settings and sheets alongside the dashboard; chart columns show a v1-style hover card; stat tiles keep a quarter-row width when there are few platforms
- [x] Speed and DB cost: user-data reads are server-cached per user and day (`"use cache: remote"`, tag per user, dropped on every write: actions, sync steps, extension); the dashboard's 9 reads go to Neon as one batch; Better Auth's session cookie cache, refreshed in `proxy.ts`; the session read has a lifetime and the pill nav prefetches fully, so every page opens without a skeleton; pages stay in the client router for 30 minutes. Measured on a production build: repeat loads went from about 12 Neon queries to 0, and nav clicks render in 10–30 ms. Contests shows a note instead of an empty card for a platform with no contests
- [x] Owner feedback: public tiles show solved per platform (rating as the sub line, so LeetCode appears without contests); the owner banner names unverified, hidden handles; the extension panel moved from Settings to Connect under the LeetCode card, with `EXTENSION_STORE_URL` (`lib/extension.ts`) for the Chrome Web Store link once it ships
- [x] Google sign-in beside GitHub (owner request, 18 Oct 2026): optional `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, buttons only for configured providers; same verified email links to the same user (Better Auth implicit linking); Google users get a username from their email's local part (`-2`, `-3` on clashes, GitHub logins too); new `users.github_login` (migration `0008`, applied to Neon, backfilled) is what the profile shows as the verified GitHub link
- [x] 👤 Owner: Google OAuth client and a real Google sign-in, in production too (18 Oct 2026)
- [x] Striver's 180 sheet (§1), and sheets start unfollowed for new users (owner, 18 Oct 2026). A section with no LeetCode problem (Mathematics) shows "Not tracked" and isn't offered as training in Topics or Today
- [x] V11 more platforms (§9), built 18 Oct 2026 on `v2-platforms`: contract and migration `0009` (applied to dev Neon), `POST /api/extension/platform` (checked end to end against the dev server: a 170-problem GFG upload connects and verifies the handle, a repeat adds nothing, a different logged-in user gets 409), Connect/Progress/totals for the five, and the extension 0.2.0 (one popup for LeetCode and the five, in the site's palette and fonts, light and dark). HackerRank's count is the distinct solved list when it's complete, since its badge `solved` numbers overlap across domains
- [x] Extension 0.3.0, built 19 Oct 2026 on `v2-extension-connect` (§9 "When it reads", "Connecting"): one-click connect through `/extension/connect` and `POST /api/extension/connect` (checked against the dev server: 403 without the header or cross-site, 401 signed out, a token that works on `/me`, rotation at the cap), a first sync of every platform on connect, automatic sync on visits (6 h) and LeetCode daily, per-platform last-run lines in the popup, and token creation removed from Connect
- [x] Extension 0.3.1, 19 Oct 2026 on `v2-extension-leetcode-access`: LeetCode failed CORS from the service worker unless leetcode.com was open, because Chrome withholds the install-time `leetcode.com` host permission when site access is limited ("On click" etc.) and nothing asked for it again. Connect and Sync now request it like the other five, the LeetCode job stops with a clear "needs permission" message without it, and `/privacy` says LeetCode access can be declined too
- [ ] 👤 Owner: load the unpacked extension 0.3.0, click Connect, and check that the first sync runs and that a visit to a platform syncs it (the extension flow can't be driven from here)
- [ ] 👤 Owner: apply migration `0009` to production Neon, then the PR into `v2` can merge
- [ ] 👤 Owner: load the unpacked extension and Sync each of the five while logged in. The identity reads and the logged-in lists (CodeChef `/recent/user`, HackerRank submissions, InterviewBit `has_solved`, Code360 `view_solved_problems`) were built from research and synthetic fixtures, not a real session. 19 Oct 2026: InterviewBit verified in a real session (9 solves uploaded; `__INTERVIEWBIT__.user.username`, `has_solved`), HackerRank's identity verified (`/rest/contests/master/hackers/me` → `model.username`; the owner's account has no submissions, so the list is untested). A tab opened before logging in reads as logged out, so a `NotLoggedInError` in a reused tab is retried in a fresh one
- [x] Chrome Web Store prep, 19 Oct 2026 on `v2-extension-store`: the extension defaults to and is granted `https://codelogs.techsavy.space` (localhost only as an optional dev host), the optional `https://*/*` is gone (a manifest test rejects wildcard hosts), a public `/privacy` page covers the site and the extension, and `pnpm extension:zip` builds the upload
- [x] Support and feedback (owner request, 19 Oct 2026): a footer on every page with the owner's UPI ID (copy, `upi://` link on phones, QR popover on laptops; PR #40), and on `v2-feedback` a public `/feedback` form linked from the footer. Messages go to a new `feedback` table (migration `0010`, applied to dev Neon) with the IP stored only as an HMAC. Limits: 5 an hour and 15 a day per sender (account or IP), 500 a day overall, plus a honeypot field. Text is cleaned of invisible characters (zero-width, bidi, Unicode tags) before it's stored, and `pnpm feedback` prints it as JSON under an "untrusted content" header (CLAUDE.md rule). Checked end to end in headless Chrome against the dev server: validation errors, honeypot not stored, hidden tag text stripped, the 6th message in an hour refused
- [ ] 👤 Owner: apply migration `0010` to production Neon, then the feedback PR can merge
- [x] Extension 0.3.2, 19 Oct 2026 on `v2-extension-codelogs-access`: the same withheld-access problem as 0.3.1, for CodeLogs itself. With limited site access Chrome also withholds `codelogs.techsavy.space`, and the API sends no CORS headers, so Connect never finished (the connect tab's URL is hidden) and every upload failed. Connect and Sync now ask for the CodeLogs origin too, Connect stops with a message without it, and a job without it says so. The upload routes' 401 no longer points at Settings (tokens come from Connect since 0.3.0)
- [x] Extension 0.3.3, 19 Oct 2026 on `v2-extension-store-listing`: the store rejected 0.3.2 for "excessive keywords" (violation "Yellow Argon"), quoting the list of six platform names in the manifest `description` (the listing's summary line). The summary no longer lists them; the store description names them once, in a sentence
- [ ] 👤 Owner: submit the extension to the Chrome Web Store, then set `EXTENSION_STORE_URL` in `lib/extension.ts` to its listing
- [ ] 👤 Owner: click through `v2` (Today's Mark done, Sheets ticks and follows, Friends with a second account, Settings daily goal), then decide when `v2` replaces `main`

## 9. More platforms: CodeChef, Code360, HackerRank, InterviewBit, GFG (V11, from 18 Oct 2026)
### Decisions (owner, 18 Oct 2026)
- **These five are the targets.** Platforms with open public APIs (DMOJ, Codewars, yukicoder, …; `scripts/spike/platforms/public-api-platforms.md`) are out of scope.
- **Extension only.** The server never fetches these five, and there is no server "counts" layer for them. This replaces PLAN.md §4 "More platforms" for them. Why (`scripts/spike/platforms/codolio-platforms.md`): CodeChef's terms ban spidering and scraping; GFG's ban bots and scripts; InterviewBit's ban spiders and its robots.txt disallows `/profile`; HackerRank's robots.txt disallows `/rest/` and `/profile/`; Code360's terms couldn't be read.
- **Other routes considered and dropped:** server fetches of the public JSON (above); CodeChef's official API (the developer portal is gone, and access is by email to api@codechef.com only; the owner may ask, not planned); manual count entry on Connect (owner: no); third-party aggregators (they scrape, so the same problem); a bookmarklet (the extension with worse UX).
- **Verification is a login match.** A handle on these platforms becomes verified when the extension uploads while the browser is logged in to that platform as that handle. There's no bio code. The first upload also connects the handle if the user hasn't added it on Connect. Someone hand-crafting requests with their own CodeLogs token could forge it; accepted.
- **How the extension reads:** inside a tab of the platform's own site (an open one, or a background tab it opens and closes), using the same requests that site's frontend makes, with the user's own session. One request at a time, at least 1.5 s apart, with back-off on 429/403. It sends CodeLogs only handles, problem ids, titles, URLs, difficulty labels, dates and counts: never cookies, passwords or code. Host access for each platform is an optional permission, asked in one prompt when the user clicks Connect (or on that platform's first Sync if declined).
- **When it reads (owner, 19 Oct 2026; replaces "only when the user clicks Sync"):** once for every platform right after connecting (background tabs allowed, since the user just clicked), then automatically: on a page load on the platform when its last sync is older than 6 hours, in that same tab only (never a tab of its own), and LeetCode daily from an hourly alarm. A switch in the popup turns automatic sync off; Sync stays for "now". Why the visit trigger: it looks like the user's own browsing, which keeps it clear of the "no bots" terms (GFG, CodeChef), and Chrome Web Store policy needs disclosed consent, which the Connect screen gives.
- **Connecting (owner, 19 Oct 2026):** no token to copy. The popup's Connect opens `/extension/connect`. Once the page shows a signed-in user, the extension runs a script in that tab that calls `POST /api/extension/connect` same-origin with the session (custom header and Origin check against CSRF), and stores the returned "Browser extension" token. At the 5-token cap the least recently used "Browser extension" token is replaced. Connect lists tokens as "Connected browsers" with Revoke; manual token creation is gone.

### What each platform gives
Public data was verified on 18 Oct 2026; the logged-in endpoints are in `scripts/spike/platforms/logged-in-endpoints.md`, and they need the owner's logged-in browser to confirm.

| Platform | Count | Solved list | Dates | Difficulty | Calendar |
|---|---|---|---|---|---|
| GFG | `total_problems_solved` | yes (`problems/submissions/` POST) | yes | School/Basic/Easy/Medium/Hard | – |
| CodeChef | profile page "Total Problems Solved" | names only publicly; logged-in list to confirm | no | – | to confirm |
| HackerRank | badges' `solved`, summed | recent challenges only; logged-in list to confirm | partly | – | daily submissions |
| InterviewBit | `total_problems_solved` | no | no | very_easy/easy/medium/hard | daily submissions |
| Code360 | `total_count` | logged in only (`view_solved_problems`) | no | Easy/Moderate/Hard/Ninja | to confirm |

### How the data counts
- **Totals and tiles** use the platform's own count (`platform_stats` kind `ext_counts`: total, the counts by label, and an Easy/Medium/Hard split), shown as "reported" like LeetCode's.
- **Solve rows** come from the solved list where there is one (GFG now; others once the logged-in lists are confirmed), as stub `problems` rows with the platform's difficulty label banded by `lib/sync/difficulty.ts`. They feed Recent solves, Difficulty and Solves per month.
- **Activity** comes from the platform's daily submission counts where it has them (HackerRank, InterviewBit), otherwise from the solve dates.
- **A real zero** (the platform answered, nothing solved) is a successful sync that verifies the handle (owner, 19 Oct 2026). Progress hides a platform tile that is a confirmed zero (synced, 0 solved) but keeps pending or failing ones for their status chip; the public profile and OG image list only platforms with solves.
- **Boards** count dated solves of verified handles, as for every platform, so a counts-only platform adds no weekly points.
- **Not yet:** topics and recommendations (GFG's list has no tags; InterviewBit's topic counts could feed scoring later), contests (CodeChef's rating history is on its profile page), and GFG problems in Striver's sheet.

### Code
- `lib/db/schema.ts`: `SYNCED_PLATFORMS` (CF, AtCoder, LC) and `EXTENSION_PLATFORMS` (the five), `PLATFORMS` = both; migration `0009_extension_platforms` appends the enum values. Types `SyncedPlatformId` / `ExtensionPlatformId`; `isSyncedPlatform()` in `lib/platforms.ts`. Adapters, sync claims, the stale-account cron, bio verification and "Sync now" are synced-only.
- `lib/extension-upload.ts`: the upload contract (`extensionUploadSchema`), `ext_counts`, `difficultySplit`, allowed problem hosts.
- `POST /api/extension/platform` (Bearer token) → `lib/extension-platform-ingest.ts`; `GET /api/extension/me` lists every connected handle.
- `extension/`: one extension for LeetCode and the five, styled with the site's tokens and fonts, one reader per platform in `extension/lib/platforms/` (a self-contained fetch run in the platform's tab, plus a pure parser tested against fixtures).

### V11 tasks (`v2-platforms`)
- 🧭 Contract: enum and migration `0009` (applied to dev Neon), the synced/extension split, metadata, difficulty bands, colour tokens, upload contract
- 🤖∥ Research: logged-in identity and solved-list endpoints for the five (from open-source extensions)
- 🤖∥ Server ingest: `lib/extension-platform-ingest.ts`, the route, `me` with every handle, tests
- 🤖∥ App: Connect cards for extension platforms (no Sync now or bio code; "Sync with the extension"), totals and tiles from `ext_counts`, every platform list and colour in Progress, Friends, the public profile and the OG image
- 🤖 Extension: the restructure, the site theme, five readers with fixture tests, the popup listing each platform with its handle and a Sync button
- 👤 Owner: log in to each platform and run Sync in the extension; the logged-in requests couldn't be tested without an account
- 👤 Owner: apply migration `0009` to the production Neon database before the PR merges
- **Done when:** an upload for each platform lands in the dashboard (totals, tiles, recent solves where there is a list), the extension matches the site in light and dark, and the checks pass.
