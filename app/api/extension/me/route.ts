import { eq } from "drizzle-orm";
import { listRemovedPlatforms } from "@/lib/accounts";
import { authenticateBearer } from "@/lib/api-tokens";
import type { PlatformId } from "@/lib/adapters/types";
import { db } from "@/lib/db/client";
import { platformAccounts } from "@/lib/db/schema";

// The browser extension's connection check: who the token belongs to, their LeetCode handle
// (the current extension reads it), every connected handle, and the platforms the user removed
// (its automatic syncs skip those).
export async function GET(request: Request) {
  const user = await authenticateBearer(request.headers.get("authorization"));
  if (!user) return unauthorized();
  const [accounts, removed] = await Promise.all([
    db
      .select({
        platform: platformAccounts.platform,
        handle: platformAccounts.handle,
        verified: platformAccounts.verified,
        lastSyncedAt: platformAccounts.lastSyncedAt,
      })
      .from(platformAccounts)
      .where(eq(platformAccounts.userId, user.userId)),
    listRemovedPlatforms(user.userId),
  ]);

  const handles: Partial<
    Record<PlatformId, { handle: string; verified: boolean; lastSyncedAt: string | null }>
  > = {};
  for (const a of accounts) {
    handles[a.platform] = {
      handle: a.handle,
      verified: a.verified,
      lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    };
  }
  return Response.json(
    { username: user.username, leetcodeHandle: handles.leetcode?.handle ?? null, handles, removed },
    { headers: noStore },
  );
}

function unauthorized() {
  return Response.json(
    { error: "Invalid or revoked token. Connect the extension again from its popup." },
    { status: 401, headers: noStore },
  );
}

const noStore = { "Cache-Control": "no-store" };
