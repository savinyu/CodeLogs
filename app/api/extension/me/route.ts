import { and, eq } from "drizzle-orm";
import { authenticateBearer } from "@/lib/api-tokens";
import { db } from "@/lib/db/client";
import { platformAccounts } from "@/lib/db/schema";

// The browser extension's connection check: who the token belongs to and their LeetCode handle.
export async function GET(request: Request) {
  const user = await authenticateBearer(request.headers.get("authorization"));
  if (!user) return unauthorized();
  const [account] = await db
    .select({ handle: platformAccounts.handle })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, user.userId), eq(platformAccounts.platform, "leetcode")))
    .limit(1);
  return Response.json(
    { username: user.username, leetcodeHandle: account?.handle ?? null },
    { headers: noStore },
  );
}

function unauthorized() {
  return Response.json(
    { error: "Invalid or revoked token. Create a new one in CodeLogs Settings." },
    { status: 401, headers: noStore },
  );
}

const noStore = { "Cache-Control": "no-store" };
