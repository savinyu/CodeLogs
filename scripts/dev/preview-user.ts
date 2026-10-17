// Preview users for checking pages signed in (v2). `create` clones a real user's platform data
// into a new throwaway user and signs a session for it; `delete` removes every preview user
// (everything cascades from users.id). The session cookie goes to .preview/<username>.cookie
// (gitignored) and is never printed.
//
//   pnpm dev:preview create [--from savinyu] [--name "Anvi Kapoor"] [--empty]
//   pnpm dev:preview delete <preview-username> | --all
import { randomBytes, createHmac, randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL!);
const PREFIX = "preview-";
const DIR = ".preview";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** Better Auth's signed cookie value (better-call signCookieValue: HMAC-SHA256, base64). */
function signedToken(token: string): string {
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(token)
    .digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

async function create() {
  const from = arg("from") ?? "savinyu";
  const empty = process.argv.includes("--empty");
  const [source] = await sql.query(`select id, name from users where username = $1`, [from]);
  if (!source && !empty) throw new Error(`No user with username "${from}"`);

  const suffix = randomBytes(3).toString("hex");
  const userId = `${PREFIX}${suffix}`;
  const username = `${PREFIX}${suffix}`;
  const name = arg("name") ?? source?.name ?? "Preview User";
  await sql.query(
    `insert into users (id, name, email, username, public_profile) values ($1, $2, $3, $4, true)`,
    [userId, name, `${username}@preview.invalid`, username],
  );

  if (!empty && source) {
    const accounts = await sql.query(
      `select id, platform, handle, verified, status, history_complete, last_synced_at
         from platform_accounts where user_id = $1`,
      [source.id],
    );
    for (const a of accounts) {
      const id = randomUUID();
      await sql.query(
        `insert into platform_accounts (id, user_id, platform, handle, verified, status, history_complete, last_synced_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          userId,
          a.platform,
          a.handle,
          a.verified,
          a.status,
          a.history_complete,
          a.last_synced_at,
        ],
      );
      await sql.query(
        `insert into solves (user_id, account_id, problem_id, first_solved_at, source)
         select $1, $2, problem_id, first_solved_at, source from solves where account_id = $3`,
        [userId, id, a.id],
      );
      for (const table of ["activity_days", "platform_stats", "contest_results"]) {
        const cols = await sql.query(
          `select column_name from information_schema.columns
            where table_name = $1 and column_name <> 'account_id' order by ordinal_position`,
          [table],
        );
        const list = cols.map((c) => `"${c.column_name}"`).join(", ");
        await sql.query(
          `insert into ${table} (account_id, ${list}) select $1, ${list} from ${table} where account_id = $2`,
          [id, a.id],
        );
      }
    }
    await sql.query(
      `insert into social_links (user_id, kind, value) select $1, kind, value from social_links where user_id = $2`,
      [userId, source.id],
    );
  }

  const token = randomBytes(24).toString("base64url");
  await sql.query(
    `insert into sessions (id, token, user_id, expires_at) values ($1, $2, $3, now() + interval '1 day')`,
    [randomUUID(), token, userId],
  );
  mkdirSync(DIR, { recursive: true });
  const file = `${DIR}/${username}.cookie`;
  writeFileSync(file, `better-auth.session_token=${signedToken(token)}\n`);
  console.log(
    `Created ${username} ("${name}"${empty ? ", no platforms" : `, cloned from ${from}`}).`,
  );
  console.log(`Cookie file: ${file}  (pnpm dev:shot <url> <out.png> --cookie ${file})`);
}

/** Deletes one preview user, or every one with --all (other people's checks may be using them). */
async function remove() {
  const target = process.argv[3];
  if (!target) throw new Error("Name the preview user to delete, or pass --all");
  const all = target === "--all";
  if (!all && !target.startsWith(PREFIX)) throw new Error(`Not a preview user: ${target}`);
  const rows = await sql.query(
    `delete from users where id like $1 and ($2 or username = $3) returning username`,
    [`${PREFIX}%`, all, target],
  );
  for (const r of rows) rmSync(`${DIR}/${r.username}.cookie`, { force: true });
  console.log(`Deleted ${rows.length} preview user(s).`);
}

const command = process.argv[2];
if (command === "create") await create();
else if (command === "delete") await remove();
else {
  console.error(
    "Usage: pnpm dev:preview create [--from <username>] [--name <name>] [--empty] | delete <username> | delete --all",
  );
  process.exit(1);
}
