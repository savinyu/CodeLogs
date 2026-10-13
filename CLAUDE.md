# CodeLogs

A cross-platform tracker for DSA and competitive programming progress. It pulls solved problems from **Codeforces, AtCoder and LeetCode** into one dashboard: totals, a heatmap, difficulty and topic breakdowns. Its differentiators are **one shared topic list, weak-topic scoring and "solve next" recommendations**. Side and portfolio project, no deadline. "CodeLogs" is a working name.

@AGENTS.md

## Start here after `/clear`
1. **`PLAN.md` is the source of truth.** §4 lists the decisions, §6 the architecture and data model, §7 the milestones, and **§12 the progress checklist showing where we are**.
2. `scripts/spike/FINDINGS.md` has the verified API facts for each platform, such as quirks, rate limits and the error shapes for unknown handles. Read it before touching an adapter.
3. Run `git log --oneline -15` and `gh pr list` (see Git below) to see recent work.
4. Don't change a decision in PLAN.md §4 without asking the owner first.

## Stack
- **Next.js 16.4** (App Router, **Cache Components on**, Turbopack), React 19.3, TypeScript (strict, `noUncheckedIndexedAccess`)
- **Tailwind 4** + **shadcn/ui** (`base-nova` style on **Base UI**, not Radix; use the `render` prop, there's no `asChild`). `cn` comes from the `cn` package.
- **Postgres on Neon** through **Drizzle ORM** (`drizzle-orm/neon-http`: no interactive transactions; use `db.batch([...])` for atomic writes)
- **Better Auth** with GitHub login (Drizzle adapter, `usePlural`). It replaced Auth.js on 12 Oct 2026 because Auth.js v5 never left beta.
- **Inngest** for background sync (from M2): one `step.run` per page fetch, `step.sleep` for rate limits
- **Vitest** for tests, ESLint (next config + prettier) and Prettier (`printWidth` 100; Markdown is ignored)
- **pnpm** only. Build scripts must be allow-listed in `pnpm-workspace.yaml` (`allowBuilds`). pnpm 12 also rejects any package version **published less than 24 h ago** on a fresh install, so CI fails even when the local install worked. When adding a dependency, pin a version at least a day old (check `npm view <pkg> time`).

## Commands
```bash
pnpm dev               # http://localhost:3000 (the GitHub OAuth callback is registered for this port)
pnpm typecheck         # next typegen && tsc --noEmit
pnpm lint
pnpm format            # prettier --write . ; format:check in CI
pnpm test              # vitest run (no DB or network needed)
pnpm db:generate --name <change>   # after editing lib/db/schema.ts → SQL in lib/db/migrations/
pnpm db:migrate        # apply migrations to the DATABASE_URL in .env.local
pnpm db:studio
pnpm db:state          # row counts, platform accounts, recent sync and catalog runs
pnpm inngest:dev       # Inngest dev server (http://localhost:8288); needs INNGEST_DEV=1 in .env.local
pnpm spike:cf | spike:atcoder | spike:leetcode   # M0 probe scripts (live API calls)
```
Before calling work done, run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`. CI (`.github/workflows/ci.yml`) runs the same checks.

## Layout
```
app/                    routes; api/auth/[...all] is the Better Auth handler
  connect/              add/remove platform handles (server actions)
  dashboard/
components/ui/          shadcn components (generated: prefer re-adding over hand-editing)
components/             app components (site-header, theme-toggle, auth/…)
components/dashboard/   dashboard sections; dashboard-view.tsx is shared by /dashboard and /u/[username]
lib/env.ts              zod-validated env(), lazy so tests and adapters don't need env vars
lib/auth.ts             Better Auth server config  · lib/auth-client.ts for client hooks
lib/session.ts          getCurrentUser() / requireUser(): the only way pages read the session
lib/db/                 schema.ts, client.ts, migrations/
lib/adapters/           types.ts (contract), http.ts, errors.ts, {codeforces,atcoder,leetcode}.ts, index.ts (registry), validate.ts
lib/sync/               upsert.ts, runs.ts (DB writes, server-only); cursor.ts, rows.ts, difficulty.ts (pure); request.ts
lib/inngest/            client.ts, functions/ (syncAccount, syncCatalog, syncCatalogs); served at app/api/inngest
lib/dashboard/          types.ts (view model, colors), aggregate.ts + heatmap.ts + filters.ts (pure, tested), queries.ts (server-only)
lib/topics/             taxonomy.ts (10 macro → micro topics), mappings/ (CF + LC tag → topic), scoring.ts (pure, tested), recommend.ts (server-only)
lib/github-username.ts  sets users.username from GitHub (Better Auth account hook); scripts/dev/backfill-usernames.ts
lib/platforms.ts        per-platform display metadata and handle patterns
fixtures/<platform>/    saved real API responses for adapter tests
tests/                  vitest
scripts/spike/          M0 probes + FINDINGS.md
```

## Rules
- **Cache Components:** a component that reads `headers()`, `cookies()` or the session must render inside `<Suspense>`. Never await the session at the top level of a layout. Read `node_modules/next/dist/docs/` for any Next API you're unsure of; this version differs from older training data (`middleware` is now `proxy.ts`, and so on).
- **Auth:** server actions and route handlers re-check `getCurrentUser()`. `proxy.ts` is only an optimistic redirect. Every query on user data is scoped by `userId`.
- **Adapters are pure:** HTTP in, normalized data (`lib/adapters/types.ts`) out. No DB imports, so fixture tests run offline. All HTTP goes through `lib/adapters/http.ts`; tests mock it with `tests/helpers/mock-http.ts`. `validateHandle` returns `valid | invalid | retry`. Throw `PlatformUserNotFoundError` for a missing handle so the sync fails without retries.
- **Inngest steps:** fetch and write inside one `step.run` and return only small plain data (step outputs are size-limited and JSON round-tripped). Keep DB imports out of `sync-account-core.ts` so it stays unit-testable.
- **Platform politeness:** respect `minDelayMs` (CF 2000 ms, AtCoder 1100, LC 1000). LeetCode is fetched only on demand or daily. No scraping of HackerRank, CodeChef or GFG, and never ask for platform passwords or cookies.
- **Schema changes:** edit `lib/db/schema.ts`, run `pnpm db:generate --name …`, review the SQL and commit it with the schema. Don't rename Better Auth's columns (`users`, `sessions`, `accounts`, `verifications`). `accounts` holds OAuth links; platform handles live in `platform_accounts`.
- **Colors:** use the theme tokens (`bg-platform-codeforces`, `fill-heat-2`, `PLATFORM_COLOR` in `lib/dashboard/types.ts`), never hex, so dark mode keeps working. Recharts bars use `isAnimationActive={false}`.
- **Turbopack cache:** if `pnpm build` output ignores a CSS change, delete `.next/cache/turbopack` and rebuild. The dev server can also serve stale `globals.css` until the file is saved again.
- **Secrets:** only in `.env.local` (gitignored). Keep `.env.example` in sync with `lib/env.ts`. Never print secret values.

## Git and GitHub
- This Mac has two GitHub accounts. **This repo uses the personal account `savinyu`** (remote `savinyu/CodeLogs`), never `savinyu-7u`.
- The repo-local git identity is already set: `Savinyu <100479891+savinyu@users.noreply.github.com>`.
- Push over HTTPS with the repo-local credential helper, which uses `gh auth token --user savinyu`. Run `gh` commands for this repo as `GH_TOKEN=$(gh auth token --user savinyu) gh …`, which leaves the globally active gh account alone.
- One branch per milestone (`m1-foundation`, `m2-adapters-sync`, …) → PR into `main`. Commits and PRs are pre-approved by the owner.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. End PR bodies with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## How we work
- **Captain and subagents:** the main (Opus) session owns the plan, architecture, interfaces and schema, plus review and integration (🧭 tasks in PLAN.md). Self-contained tasks (🤖) go to Sonnet subagents (`model: "sonnet"`) with a precise spec: files they own, files they must not touch, and how to verify. Independent tasks run in parallel. Subagents don't commit; the captain reviews, runs the checks and commits.
- Make a todo list before starting a milestone, and update PLAN.md §12 when it lands.
- When a choice isn't settled in PLAN.md, ask the owner.
- Don't take into account development time. (because it is not being developed by a human)

## Owner's handles (for testing)
Codeforces `savinyu` (46 solved) · LeetCode `CptDailyBird` (319 solved) · AtCoder `savinyu` (empty; test with `chokudai`).
