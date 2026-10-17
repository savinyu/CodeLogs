# CodeLogs v2: Interface Plan

> Written 17 Oct 2026. The design source is the finalised claude.ai artifact **CodeLogs Coach 2** (https://claude.ai/artifact/NP8s1JJ6yxysjsuPbJBfVP). Read only that draft; the older ones are superseded. Progress is tracked in §8.

v2 rebuilds the whole interface around Coach 2: a pill-nav app with **Today, Progress, Topics, Sheets, Friends and Contests**, plus a visitor view of `/u/[username]`. The data layer from v1 (adapters, sync, scoring, recommendations, sheets) stays. PLAN.md remains the record of v1 and of every §4 decision, and those decisions still hold.

## 1. Decisions (owner, 17 Oct 2026)
- **Branches:** `v2` was cut from `main` at PR #25 and is the GitHub default branch. `main` stays as v1 and is not changed. Each milestone is a `v2-*` branch with a PR into `v2`. The captain merges a PR into `v2` once CI and review pass. A branch can't be named `v2/…` because `v2` exists.
- **Friends** are in scope: mutual friend requests, a weekly friends board, and an opt-in global board.
- **Leaderboards are difficulty-weighted.** A solve earns points equal to its difficulty band (Band 1 = 1 … Band 5 = 5). An unrated solve earns 1. Boards rank by points, then solves, then active days.
- **Sheets:** follow and unfollow sheets, manual "Solved it" ticks (they count only inside sheets, never in totals, topics or boards), and **Striver's SDE sheet** as a hand-made list of its LeetCode problems. Its non-LeetCode problems are listed but not counted. *Blocked (17 Oct 2026):* takeuforward no longer serves the 191-problem day list (its current sheet is a different, JS-rendered 179-problem list), so no list was compiled. The owner is to supply the list or pick the current sheet; the sheet cards already handle off-platform problems.
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
- `sheet_follows` stores explicit choices only. With no row, NeetCode 150 counts as followed and the other sheets don't (`lib/sheets/follow.ts`).
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
- **Public profile:** an owner banner when you view your own page, the hero (large avatar, name, @username · solving since, social link pills, verified handle chips), tiles (total, CF rating, LC contest rating), Active days and the heatmap (last 12 months, no filter), the public topic map (area and green step by solves; no expected or weak values), contest cards, badges, recently solved (6), and a sign-in CTA for signed-out visitors. The OG image moves to the v2 palette and fonts.

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
- [ ] 👤 Owner: Striver's SDE sheet list (§1)
- [ ] 👤 Owner: click through `v2` (Today's Mark done, Sheets ticks and follows, Friends with a second account, Settings daily goal), then decide when `v2` replaces `main`
