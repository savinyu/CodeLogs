// Writes a user's full LeetCode solved list, from the JSON import (Connect page) or the browser
// extension (/api/extension/leetcode). The caller has already authenticated the user. An extension
// upload with no LeetCode handle connected yet connects the logged-in one.

import "server-only";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { connectLoggedInHandle } from "@/lib/accounts";
import { invalidateUser } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { platformAccounts, platformStats, solves } from "@/lib/db/schema";
import { slugFallback } from "@/lib/leetcode-import";
import { requestFirstSync } from "@/lib/sync/request";
import { refreshHistoryComplete } from "@/lib/sync/runs";
import { applySnapshot } from "@/lib/sync/upsert";

export type IngestResult =
  | {
      ok: true;
      imported: number;
      alreadyKnown: number;
      skipped: number;
      /** Known solves that had no date and got one from this upload. */
      datesFilled: number;
      complete: boolean;
      known: number;
      lifetime: number | null;
      /** This upload verified the handle (an extension upload is a login match). */
      newlyVerified: boolean;
      /** This upload connected the handle (verified), with no handle connected before. */
      created: boolean;
    }
  | { ok: false; error: string; status: 400 | 404 | 409 | 500 | 503 };

export interface IngestInput {
  /** The leetcode.com user the list belongs to; must match the connected handle. */
  userName: string;
  solves: { slug: string; solvedAt: number | null }[];
  /** LeetCode's own solved count from the same response, if the caller has it. */
  numSolved?: number | null;
  /** Extension: the user clicked LeetCode, so a handle they removed is connected again. */
  manual?: boolean;
}

const lcStatsSchema = z.object({ solved: z.object({ all: z.number().optional() }) });
const SAVE_FAILED = "Something went wrong while importing. Try again.";

export async function ingestLeetcodeSolves(
  userId: string,
  input: IngestInput,
  source: "import" | "extension",
): Promise<IngestResult> {
  let [account] = await db
    .select({ id: platformAccounts.id, handle: platformAccounts.handle })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.platform, "leetcode")))
    .limit(1);
  // A JSON file proves nothing about who saved it, so an import needs the handle connected first.
  if (!account && source === "import") {
    return { ok: false, status: 404, error: "Connect your LeetCode handle first." };
  }

  const userName = input.userName.trim();
  if (userName === "") {
    return {
      ok: false,
      status: 400,
      error:
        source === "import"
          ? "You weren't logged in on leetcode.com when you saved the file."
          : "You aren't logged in on leetcode.com in this browser.",
    };
  }
  let created = false;
  if (!account) {
    const connected = await connectLoggedInHandle(
      userId,
      "leetcode",
      userName,
      input.manual === true,
    ).catch((err) => {
      console.error("LeetCode connect failed", err);
      return null;
    });
    if (!connected) return { ok: false, status: 500, error: SAVE_FAILED };
    if (!connected.ok) return connected;
    account = connected;
    created = true;
  }
  if (userName.toLowerCase() !== account.handle.toLowerCase()) {
    const what =
      source === "import" ? "This file belongs to" : "This browser is logged in to LeetCode as";
    return {
      ok: false,
      status: 409,
      error: `${what} ${userName}, but your connected LeetCode handle is ${account.handle}.`,
    };
  }

  // One entry per slug, keeping the earliest known date.
  const bySlug = new Map<string, number | null>();
  for (const { slug, solvedAt } of input.solves) {
    const seen = bySlug.get(slug);
    if (seen === undefined || (solvedAt !== null && (seen === null || solvedAt < seen))) {
      bySlug.set(slug, solvedAt);
    }
  }

  try {
    // The browser is logged in to LeetCode as the connected handle: a login match verifies it,
    // as for the extension platforms (PLAN-v2.md §9). A JSON file proves nothing, so imports don't.
    // Before the snapshot, whose cache invalidation then covers this write too.
    const newlyVerified =
      source === "extension" &&
      (
        await db
          .update(platformAccounts)
          .set({ verified: true, verifyToken: null })
          .where(and(eq(platformAccounts.id, account.id), eq(platformAccounts.verified, false)))
          .returning({ id: platformAccounts.id })
      ).length > 0;
    const result = await applySnapshot(
      { accountId: account.id, userId, platform: "leetcode" },
      {
        solves: [...bySlug].map(([slug, solvedAt]) => ({
          platform: "leetcode" as const,
          externalProblemId: slug,
          ...(solvedAt !== null ? { firstSolvedAt: new Date(solvedAt * 1000) } : {}),
          problemFallback: slugFallback(slug),
        })),
        extras: [],
      },
      { source },
    );
    const complete = await refreshHistoryComplete(account.id);
    if (created) {
      // The server's own sync adds what the extension doesn't read: difficulty counts, contests.
      await requestFirstSync(userId, "leetcode");
      invalidateUser(userId);
    }

    const [[stat], [known]] = await Promise.all([
      db
        .select({ payload: platformStats.payload })
        .from(platformStats)
        .where(
          and(
            eq(platformStats.accountId, account.id),
            eq(platformStats.kind, "lc_difficulty_counts"),
          ),
        )
        .limit(1),
      db
        .select({ n: count() })
        .from(solves)
        .where(and(eq(solves.userId, userId), eq(solves.accountId, account.id))),
    ]);
    const lifetime =
      lcStatsSchema.safeParse(stat?.payload).data?.solved.all ?? input.numSolved ?? null;

    const { solvesInserted, solvesSkipped, datesFilled } = result;
    return {
      ok: true,
      imported: solvesInserted,
      alreadyKnown: Math.max(0, bySlug.size - solvesInserted - solvesSkipped),
      skipped: solvesSkipped,
      datesFilled,
      complete,
      known: known?.n ?? 0,
      lifetime,
      newlyVerified,
      created,
    };
  } catch (err) {
    console.error(`LeetCode ${source} failed`, err);
    return { ok: false, status: 500, error: SAVE_FAILED };
  }
}
