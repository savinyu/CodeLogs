// Dev-only: gives a preview user data for the extension-only platforms (PLAN-v2.md §9), as if the
// browser extension had uploaded it, so the pages can be checked with up to eight platforms.
//
//   pnpm dev:preview create --from savinyu      # prints the preview username
//   pnpm dev:seed-ext preview-xxxxxx            # GFG (verified, 10 solves), InterviewBit
//                                               # (verified, counts + 30 activity days),
//                                               # HackerRank (pending, never synced)
//
// Refuses unless the user was made by `pnpm dev:preview create` (its "preview-" id prefix), and
// refuses in production or when DATABASE_URL looks like a production host. Plain SQL like
// preview-user.ts: lib/sync/upsert.ts is server-only and can't run under tsx. Re-running replaces
// the three accounts. Reload the dev server page afterwards (the cache tag isn't invalidated here;
// a fresh preview user has no cached data, otherwise wait out the 30-minute client cache).
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { difficultySplit, EXT_COUNTS_KIND } from "../../lib/extension-upload";
import { normalizeDifficulty } from "../../lib/sync/difficulty";

config({ path: ".env.local", quiet: true });

const username = process.argv[2];
if (!username?.startsWith("preview-")) {
  console.error(
    "Usage: pnpm dev:seed-ext <preview-username>  (a user made by pnpm dev:preview create)",
  );
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run with NODE_ENV=production.");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const host = new URL(url).hostname;
if (/prod/i.test(host) || /prod/i.test(process.env.VERCEL_ENV ?? "")) {
  console.error("Refusing: DATABASE_URL looks like a production database.");
  process.exit(1);
}

const sql = neon(url);
const [user] = await sql.query(`select id from users where username = $1`, [username]);
if (!user || !String(user.id).startsWith("preview-")) {
  console.error(`${username} is not a preview user (create one with pnpm dev:preview create).`);
  process.exit(1);
}
const userId: string = user.id;

const DAY_MS = 86_400_000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY_MS);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function addAccount(
  platform: string,
  handle: string,
  opts: { verified: boolean; status: "pending" | "ok" | "partial"; synced: boolean },
): Promise<string> {
  const id = randomUUID();
  await sql.query(
    `insert into platform_accounts (id, user_id, platform, handle, verified, status, last_synced_at)
     values ($1, $2, $3::platform, $4, $5, $6::account_status, $7)`,
    [id, userId, platform, handle, opts.verified, opts.status, opts.synced ? new Date() : null],
  );
  return id;
}

async function setCounts(accountId: string, payload: unknown) {
  await sql.query(
    `insert into platform_stats (account_id, kind, payload) values ($1, $2, $3::jsonb)`,
    [accountId, EXT_COUNTS_KIND, JSON.stringify(payload)],
  );
}

// Start clean so the script can be re-run.
await sql.query(
  `delete from platform_accounts where user_id = $1 and platform in ('gfg', 'interviewbit', 'hackerrank')`,
  [userId],
);

// GFG: a full solved list with dates.
const gfgAccount = await addAccount("gfg", "seed_gfg", {
  verified: true,
  status: "ok",
  synced: true,
});
const gfgLabels = [
  "School",
  "Basic",
  "Easy",
  "Easy",
  "Medium",
  "Medium",
  "Medium",
  "Hard",
  "Basic",
  "Hard",
];
const gfgByDifficulty: Record<string, number> = {};
for (const [i, label] of gfgLabels.entries()) {
  const externalId = `seed-gfg-${i + 1}`;
  gfgByDifficulty[label] = (gfgByDifficulty[label] ?? 0) + 1;
  const [problem] = await sql.query(
    `insert into problems (platform, external_id, title, url, difficulty_raw, difficulty_norm, raw_tags)
     values ('gfg', $1, $2, $3, $4, $5, '[]'::jsonb)
     on conflict (platform, external_id) do update set title = excluded.title
     returning id`,
    [
      externalId,
      `Seed GFG problem ${i + 1} (${label})`,
      `https://www.geeksforgeeks.org/problems/${externalId}/1`,
      label,
      normalizeDifficulty("gfg", label),
    ],
  );
  await sql.query(
    `insert into solves (user_id, account_id, problem_id, first_solved_at, source)
     values ($1, $2, $3, $4, 'extension')`,
    [userId, gfgAccount, problem!.id, daysAgo(3 + i * 9)],
  );
}
await setCounts(gfgAccount, {
  total: gfgLabels.length,
  byDifficulty: gfgByDifficulty,
  split: difficultySplit("gfg", gfgByDifficulty),
});

// InterviewBit: counts only, plus a daily submission calendar.
const ibAccount = await addAccount("interviewbit", "seed_ib", {
  verified: true,
  status: "partial",
  synced: true,
});
const ibByDifficulty = { very_easy: 9, easy: 22, medium: 17, hard: 4 };
await setCounts(ibAccount, {
  total: 52,
  byDifficulty: ibByDifficulty,
  split: difficultySplit("interviewbit", ibByDifficulty),
});
for (let i = 0; i < 30; i++) {
  await sql.query(`insert into activity_days (account_id, day, count) values ($1, $2, $3)`, [
    ibAccount,
    ymd(daysAgo(i * 2 + 1)),
    1 + ((i * 7) % 5),
  ]);
}

// HackerRank: connected, waiting for its first extension upload.
await addAccount("hackerrank", "seed_hr", { verified: false, status: "pending", synced: false });

console.log(
  `Seeded GFG (10 solves), InterviewBit (52 reported, 30 days), HackerRank (pending) for ${username}.`,
);
console.log("Reload the dev server page to see them.");
