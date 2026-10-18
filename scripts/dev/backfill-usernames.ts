// Sets users.username and users.githubLogin from GitHub for users who signed up before the
// account hook in lib/auth.ts existed. Safe to re-run: it only fills empty values. No secrets printed.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { and, eq, isNull, or } = await import("drizzle-orm");
  const { db } = await import("@/lib/db/client");
  const { accounts, users } = await import("@/lib/db/schema");
  const { assignGithubUsername } = await import("@/lib/github-username");

  const rows = await db
    .select({ userId: users.id, accountId: accounts.accountId, token: accounts.accessToken })
    .from(users)
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(
      and(or(isNull(users.username), isNull(users.githubLogin)), eq(accounts.providerId, "github")),
    );

  for (const row of rows) {
    const username = await assignGithubUsername(db, row.userId, row.accountId, row.token);
    console.log(row.userId, "→", username ?? "(not set)");
  }
  console.log(`${rows.length} user(s) checked`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
