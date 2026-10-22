// Writes an extension upload for CodeChef, Code360, HackerRank, InterviewBit or GFG
// (POST /api/extension/platform). The caller has authenticated the user. A logged-in-as match
// connects the handle if needed and verifies it (PLAN-v2.md §9), unless the user removed the
// platform and this upload isn't from a click on it.

import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import {
  insertLoggedInAccount,
  mayConnectFromExtension,
  removedPlatformError,
} from "@/lib/accounts";
import { checkHandleFormat } from "@/lib/adapters/handle-format";
import type { ExtensionPlatformId } from "@/lib/adapters/types";
import { invalidateUser } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { platformAccounts, solves } from "@/lib/db/schema";
import { buildPlatformSnapshot, matchAccount } from "@/lib/extension-platform-plan";
import type { ExtensionUpload } from "@/lib/extension-upload";
import { PLATFORM_META } from "@/lib/platforms";
import { applySnapshot } from "@/lib/sync/upsert";

export type PlatformIngestResult =
  | {
      ok: true;
      platform: ExtensionPlatformId;
      handle: string;
      /** True when this upload connected the handle. */
      created: boolean;
      verified: true;
      imported: number;
      alreadyKnown: number;
      /** Solve rows now held for the account. */
      listed: number;
      /** The platform's own solved count from this upload. */
      total: number | null;
    }
  | { ok: false; error: string; status: 400 | 409 | 500 };

const SAVE_FAILED = "Something went wrong while saving. Try again.";

export async function ingestExtensionUpload(
  userId: string,
  upload: ExtensionUpload,
): Promise<PlatformIngestResult> {
  const { platform } = upload;
  const name = PLATFORM_META[platform].name;

  const format = await checkHandleFormat(platform, upload.loggedInAs);
  if (format.result !== "valid") {
    return {
      ok: false,
      status: 400,
      error: `The extension read an unexpected ${name} username (${upload.loggedInAs}).`,
    };
  }
  const canonical = format.canonicalHandle;

  try {
    const find = async () => {
      const [row] = await db
        .select({ id: platformAccounts.id, handle: platformAccounts.handle })
        .from(platformAccounts)
        .where(and(eq(platformAccounts.userId, userId), eq(platformAccounts.platform, platform)))
        .limit(1);
      return row ?? null;
    };

    let account = await find();
    let created = false;
    if (!account) {
      const manual = upload.manual === true;
      if (!(await mayConnectFromExtension(userId, platform, manual))) {
        return { ok: false, status: 409, error: removedPlatformError(platform) };
      }
      // A double click inserts once: the loser re-reads.
      const inserted = await insertLoggedInAccount(userId, platform, canonical, manual);
      if (inserted === "removed") {
        return { ok: false, status: 409, error: removedPlatformError(platform) };
      }
      created = inserted !== "exists";
      account = inserted !== "exists" ? inserted : await find();
      if (!account) return { ok: false, status: 500, error: SAVE_FAILED };
    }

    const match = created
      ? ({ kind: "match", handle: canonical } as const)
      : matchAccount(account, canonical);
    if (match.kind === "mismatch") {
      return {
        ok: false,
        status: 409,
        error: `This browser is logged in to ${name} as ${canonical}, but your connected ${name} handle is ${match.connected}. Remove it on the Connect page to switch.`,
      };
    }
    if (match.kind === "create") return { ok: false, status: 500, error: SAVE_FAILED };

    const plan = buildPlatformSnapshot(upload);
    const result = await applySnapshot({ accountId: account.id, userId, platform }, plan.snapshot, {
      source: "extension",
    });

    // The account row is the only write left, and it is a single statement.
    await db
      .update(platformAccounts)
      .set({
        handle: match.handle,
        verified: true,
        verifyToken: null,
        status: plan.status,
        historyComplete: plan.historyComplete,
        lastSyncedAt: sql`now()`,
        lastError: null,
        syncRequestedAt: null,
      })
      .where(eq(platformAccounts.id, account.id));
    // applySnapshot invalidated before this status write; do it again so Connect sees it.
    invalidateUser(userId);

    const [row] = await db
      .select({ n: count() })
      .from(solves)
      .where(and(eq(solves.userId, userId), eq(solves.accountId, account.id)));

    return {
      ok: true,
      platform,
      handle: match.handle,
      created,
      verified: true,
      imported: result.solvesInserted,
      alreadyKnown: Math.max(0, plan.solveCount - result.solvesInserted - result.solvesSkipped),
      listed: row?.n ?? 0,
      total: upload.counts?.total ?? null,
    };
  } catch (err) {
    console.error(`Extension upload (${platform}) failed`, err);
    // A half-written upload may still have changed what pages show.
    invalidateUser(userId);
    return { ok: false, status: 500, error: SAVE_FAILED };
  }
}
