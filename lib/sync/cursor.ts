// Sync cursors: where an account's next incremental sync resumes (platform_accounts.sync_cursor).
// Pure, so it's testable without a DB.

import { z } from "zod";
import type { PlatformId, SyncCursor } from "@/lib/adapters/types";

const cursorSchema = z.discriminatedUnion("platform", [
  z.object({ platform: z.literal("codeforces"), maxSubmissionId: z.number().int().nonnegative() }),
  z.object({ platform: z.literal("atcoder"), fromSecond: z.number().int().nonnegative() }),
  z.object({ platform: z.literal("leetcode"), lastAcceptedAt: z.number().int().nonnegative() }),
]);

/**
 * Reads a stored cursor. Anything malformed or belonging to another platform yields null,
 * which makes the next sync a full one: safe, because every insert is ON CONFLICT DO NOTHING.
 */
export function parseCursor(platform: PlatformId, stored: unknown): SyncCursor | null {
  const parsed = cursorSchema.safeParse(stored);
  if (!parsed.success || parsed.data.platform !== platform) return null;
  return parsed.data;
}

/**
 * The cursor to persist after a sync: the last non-null cursor any page reported, else the
 * one the sync started from. Only call this once every page has succeeded.
 */
export function resolveCursor(
  start: SyncCursor | null,
  reported: readonly (SyncCursor | null)[],
): SyncCursor | null {
  for (let i = reported.length - 1; i >= 0; i--) {
    const cursor = reported[i];
    if (cursor) return cursor;
  }
  return start;
}
