"use server";

import { refresh } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { platformAccounts, platformStats, solves } from "@/lib/db/schema";
import { slugFallback } from "@/lib/leetcode-import";
import { getCurrentUser } from "@/lib/session";
import { refreshHistoryComplete } from "@/lib/sync/runs";
import { applySnapshot } from "@/lib/sync/upsert";

export type ImportResult =
  | {
      ok: true;
      imported: number;
      alreadyKnown: number;
      skipped: number;
      complete: boolean;
      known: number;
      lifetime: number | null;
    }
  | { ok: false; error: string };

const importSchema = z.object({
  userName: z.string().max(200),
  slugs: z
    .array(z.string().regex(/^[a-z0-9-]{1,120}$/, "The file has an unexpected problem name."))
    .min(1, "The file has no solved problems.")
    .max(5000, "The file has too many solved problems."),
  numSolved: z.number().int().nonnegative().nullable(),
});

const lcStatsSchema = z.object({ solved: z.object({ all: z.number().optional() }) });

export async function importLeetcodeSolves(input: unknown): Promise<ImportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to import your history." };

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid import." };
  }
  const { userName, slugs } = parsed.data;

  const [account] = await db
    .select({ id: platformAccounts.id, handle: platformAccounts.handle })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, user.id), eq(platformAccounts.platform, "leetcode")))
    .limit(1);
  if (!account) return { ok: false, error: "Connect your LeetCode handle first." };

  if (userName.trim() === "") {
    return { ok: false, error: "You weren't logged in on leetcode.com when you saved the file." };
  }
  if (userName.trim().toLowerCase() !== account.handle.toLowerCase()) {
    return {
      ok: false,
      error: `This file belongs to ${userName.trim()}, but your connected LeetCode handle is ${account.handle}.`,
    };
  }

  try {
    const result = await applySnapshot(
      { accountId: account.id, userId: user.id, platform: "leetcode" },
      {
        solves: slugs.map((s) => ({
          platform: "leetcode" as const,
          externalProblemId: s,
          problemFallback: slugFallback(s),
        })),
        extras: [],
      },
      { source: "import" },
    );
    const complete = await refreshHistoryComplete(account.id);

    const [stat] = await db
      .select({ payload: platformStats.payload })
      .from(platformStats)
      .where(
        and(
          eq(platformStats.accountId, account.id),
          eq(platformStats.kind, "lc_difficulty_counts"),
        ),
      )
      .limit(1);
    const lifetime =
      lcStatsSchema.safeParse(stat?.payload).data?.solved.all ?? parsed.data.numSolved ?? null;

    const [known] = await db
      .select({ n: count() })
      .from(solves)
      .where(and(eq(solves.userId, user.id), eq(solves.accountId, account.id)));

    const { solvesInserted, solvesSkipped } = result;
    refresh();
    return {
      ok: true,
      imported: solvesInserted,
      alreadyKnown: Math.max(0, slugs.length - solvesInserted - solvesSkipped),
      skipped: solvesSkipped,
      complete,
      known: known?.n ?? 0,
      lifetime,
    };
  } catch (err) {
    console.error("LeetCode import failed", err);
    return { ok: false, error: "Something went wrong while importing. Try again." };
  }
}
