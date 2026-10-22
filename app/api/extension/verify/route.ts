import { and, eq } from "drizzle-orm";
import { connectLoggedInHandle } from "@/lib/accounts";
import { authenticateBearer } from "@/lib/api-tokens";
import { invalidateUser } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { platformAccounts } from "@/lib/db/schema";
import { decideVerify, extensionVerifySchema } from "@/lib/extension-verify-shared";
import { requestFirstSync } from "@/lib/sync/request";

// The browser extension says which Codeforces or AtCoder user this browser is logged in as. When
// it is the connected handle, the handle becomes verified: a login match, as for the extension
// platforms (PLAN-v2.md §9). With no handle connected yet, it connects that user, verified, and
// queues the server's first sync, unless the user removed the platform and didn't click it in
// the extension. Authenticated by the extension's token, never by cookies.
export async function POST(request: Request) {
  const user = await authenticateBearer(request.headers.get("authorization"));
  if (!user) {
    return error(401, "Invalid or revoked token. Connect the extension again from its popup.");
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return error(413, "The request body is too large.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return error(400, "The request body isn't JSON.");
  }
  const parsed = extensionVerifySchema.safeParse(json);
  if (!parsed.success) return error(400, "The extension sent an unexpected username.");
  const { platform } = parsed.data;

  const where = and(
    eq(platformAccounts.userId, user.userId),
    eq(platformAccounts.platform, platform),
  );
  try {
    const [account] = await db
      .select({ handle: platformAccounts.handle, verified: platformAccounts.verified })
      .from(platformAccounts)
      .where(where)
      .limit(1);
    const decision = decideVerify(account ?? null, parsed.data);
    if (decision.kind === "error") return error(decision.status, decision.error);

    if (decision.kind === "create") {
      const connected = await connectLoggedInHandle(
        user.userId,
        platform,
        parsed.data.loggedInAs,
        parsed.data.manual === true,
      );
      if (!connected.ok) return error(connected.status, connected.error);
      await requestFirstSync(user.userId, platform);
      invalidateUser(user.userId);
      return Response.json(
        {
          ok: true,
          platform,
          handle: connected.handle,
          verified: true,
          already: false,
          created: true,
        },
        { headers: noStore },
      );
    }

    if (decision.kind === "verify") {
      // Matching the handle too, so a handle replaced mid-request can't inherit the result.
      await db
        .update(platformAccounts)
        .set({ verified: true, verifyToken: null })
        .where(and(where, eq(platformAccounts.handle, decision.handle)));
      invalidateUser(user.userId);
    }
    return Response.json(
      {
        ok: true,
        platform,
        handle: decision.handle,
        verified: true,
        already: decision.kind === "already",
        created: false,
      },
      { headers: noStore },
    );
  } catch (err) {
    console.error(`Extension verify (${platform}) failed`, err);
    return error(500, "Something went wrong while saving. Try again.");
  }
}

function error(status: number, message: string) {
  return Response.json({ ok: false, error: message }, { status, headers: noStore });
}

const noStore = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 2_000;
