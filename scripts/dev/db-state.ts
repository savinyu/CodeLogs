// Prints row counts and platform accounts, for checking syncs locally. No secrets printed.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL!);

const tables = [
  "users",
  "platform_accounts",
  "problems",
  "solves",
  "platform_stats",
  "activity_days",
  "sync_runs",
  "catalog_syncs",
];
for (const t of tables) {
  const [row] = await sql.query(`select count(*)::int as n from ${t}`);
  console.log(t.padEnd(18), row?.n);
}
console.table(
  await sql.query(
    `select pa.platform, pa.handle, pa.status, pa.last_synced_at, pa.sync_cursor, pa.last_error,
            (select count(*)::int from solves s where s.account_id = pa.id) as solves
       from platform_accounts pa order by pa.platform`,
  ),
);
console.table(
  await sql.query(
    `select platform, status, rows, error, round(extract(epoch from finished_at - started_at))::int as secs
       from catalog_syncs order by started_at desc limit 6`,
  ),
);
console.table(
  await sql.query(
    `select pa.platform, sr.status, sr.items, sr.error, round(extract(epoch from sr.finished_at - sr.started_at))::int as secs
       from sync_runs sr join platform_accounts pa on pa.id = sr.account_id order by sr.started_at desc limit 9`,
  ),
);
