// The account sync loop, free of Inngest and DB imports so it can be unit-tested with a fake
// step. Everything a step returns is JSON-serialized and replayed, so only small plain data
// crosses a step boundary: never the snapshot, never Dates.

import { NonRetriableError } from "inngest";
import { PlatformUserNotFoundError } from "@/lib/adapters/errors";
import { resolveCursor } from "@/lib/sync/cursor";
import type {
  HistoryCompleteness,
  PageToken,
  PlatformAdapter,
  PlatformId,
  PlatformSnapshot,
  SyncCursor,
} from "@/lib/adapters/types";

/** The slice of Inngest's step tools the loop needs. */
export interface SyncStep {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
  sleep(id: string, ms: number): Promise<void>;
}

export interface SyncTarget {
  accountId: string;
  userId: string;
  platform: PlatformId;
}

export interface AccountSyncDeps {
  startAccountSync(accountId: string): Promise<
    | (SyncTarget & {
        runId: number;
        handle: string;
        cursor: SyncCursor | null;
        historyComplete: boolean;
      })
    | null
  >;
  finishAccountSync(args: {
    accountId: string;
    runId: number;
    cursor: SyncCursor | null;
    items: number;
    history: HistoryCompleteness;
    historyComplete: boolean;
  }): Promise<void>;
  applySnapshot(
    target: SyncTarget,
    snapshot: PlatformSnapshot,
  ): Promise<{ solvesInserted: number }>;
  getAdapter(
    platform: PlatformId,
  ): Pick<PlatformAdapter, "fetchPage" | "minDelayMs" | "capabilities">;
}

export const MAX_SYNC_PAGES = 300;

export type AccountSyncResult =
  { skipped: true } | { skipped: false; pages: number; items: number };

export async function runAccountSync(
  accountId: string,
  step: SyncStep,
  deps: AccountSyncDeps,
): Promise<AccountSyncResult> {
  const account = await step.run("start", () => deps.startAccountSync(accountId));
  if (!account) return { skipped: true };

  const adapter = deps.getAdapter(account.platform);
  const target: SyncTarget = {
    accountId: account.accountId,
    userId: account.userId,
    platform: account.platform,
  };
  const reported: (SyncCursor | null)[] = [];
  let items = 0;
  let page: PageToken | null = null;

  for (let i = 0; ; i++) {
    if (i >= MAX_SYNC_PAGES) {
      throw new NonRetriableError(`Sync exceeded ${MAX_SYNC_PAGES} pages; giving up.`);
    }
    const currentPage = page;
    // Fetch and write in one step: the snapshot can be large and must not become step output.
    const result: {
      nextPage: PageToken | null;
      resumeCursor: SyncCursor | null;
      solvesInserted: number;
    } = await step.run(`page-${i}`, async () => {
      const fetched = await adapter
        .fetchPage(account.handle, account.cursor, currentPage)
        .catch((err: unknown) => {
          // A renamed or deleted handle won't come back on retry: fail the run now.
          if (err instanceof PlatformUserNotFoundError) throw new NonRetriableError(err.message);
          throw err;
        });
      const applied = await deps.applySnapshot(target, fetched.snapshot);
      return {
        nextPage: fetched.nextPage,
        resumeCursor: fetched.resumeCursor,
        solvesInserted: applied.solvesInserted,
      };
    });
    reported.push(result.resumeCursor);
    items += result.solvesInserted;
    if (result.nextPage === null) break;
    page = result.nextPage;
    await step.sleep(`wait-${i}`, adapter.minDelayMs);
  }

  await step.run("finish", () =>
    deps.finishAccountSync({
      accountId: account.accountId,
      runId: account.runId,
      cursor: resolveCursor(account.cursor, reported),
      items,
      history: adapter.capabilities.history,
      historyComplete: account.historyComplete,
    }),
  );
  return { skipped: false, pages: reported.length, items };
}
