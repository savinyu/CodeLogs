import { NonRetriableError } from "inngest";
import { describe, expect, it, vi } from "vitest";
import { PlatformUserNotFoundError } from "@/lib/adapters/errors";
import type { PageToken, PlatformSnapshot, SyncCursor, SyncPage } from "@/lib/adapters/types";
import {
  MAX_SYNC_PAGES,
  runAccountSync,
  type AccountSyncDeps,
  type SyncStep,
} from "@/lib/inngest/functions/sync-account-core";

const START_CURSOR: SyncCursor = { platform: "codeforces", maxSubmissionId: 10 };
const EMPTY: PlatformSnapshot = { solves: [], extras: [] };

function fakeStep() {
  const runs: string[] = [];
  const sleeps: { id: string; ms: number }[] = [];
  const step: SyncStep = {
    // Mimic Inngest's JSON round trip so nothing relies on class instances surviving a step.
    run: async (id, fn) => {
      runs.push(id);
      const out = await fn();
      return (out === undefined ? out : JSON.parse(JSON.stringify(out))) as Awaited<
        ReturnType<typeof fn>
      >;
    },
    sleep: async (id, ms) => {
      sleeps.push({ id, ms });
    },
  };
  return { step, runs, sleeps };
}

function fakeDeps(opts: {
  pages: SyncPage[];
  account?: Awaited<ReturnType<AccountSyncDeps["startAccountSync"]>>;
  inserted?: number;
}) {
  const fetchPage = vi.fn(
    async (_handle: string, _cursor: SyncCursor | null, page: PageToken | null) => {
      const next = opts.pages[page ?? 0];
      if (!next) throw new Error(`unexpected page ${page}`);
      return next;
    },
  );
  const deps = {
    startAccountSync: vi.fn(async () =>
      opts.account === undefined
        ? {
            accountId: "acc1",
            userId: "u1",
            platform: "codeforces" as const,
            handle: "tourist",
            runId: 7,
            cursor: START_CURSOR,
            historyComplete: false,
          }
        : opts.account,
    ),
    finishAccountSync: vi.fn(async () => {}),
    applySnapshot: vi.fn(async () => ({ solvesInserted: opts.inserted ?? 2 })),
    getAdapter: vi.fn(() => ({
      fetchPage,
      minDelayMs: 2000,
      capabilities: {
        history: "full" as const,
        topicTags: true,
        topicCounts: false,
        activityCalendar: false,
      },
    })),
  } satisfies AccountSyncDeps;
  return { deps, fetchPage };
}

const page = (nextPage: PageToken | null, resumeCursor: SyncCursor | null): SyncPage => ({
  snapshot: EMPTY,
  nextPage,
  resumeCursor,
});

describe("runAccountSync", () => {
  it("loops over pages, sleeping between them but not after the last", async () => {
    const c1: SyncCursor = { platform: "codeforces", maxSubmissionId: 50 };
    const c2: SyncCursor = { platform: "codeforces", maxSubmissionId: 99 };
    const { deps, fetchPage } = fakeDeps({
      pages: [page(1, c1), page(2, null), page(null, c2)],
    });
    const { step, runs, sleeps } = fakeStep();

    const result = await runAccountSync("acc1", step, deps);

    expect(runs).toEqual(["start", "page-0", "page-1", "page-2", "finish"]);
    expect(sleeps).toEqual([
      { id: "wait-0", ms: 2000 },
      { id: "wait-1", ms: 2000 },
    ]);
    expect(fetchPage.mock.calls.map((c) => c[2])).toEqual([null, 1, 2]);
    expect(result).toEqual({ skipped: false, pages: 3, items: 6 });
  });

  it("passes the same start cursor to every page and the account to applySnapshot", async () => {
    const { deps, fetchPage } = fakeDeps({
      pages: [
        page(1, { platform: "codeforces", maxSubmissionId: 20 }),
        page(null, { platform: "codeforces", maxSubmissionId: 30 }),
      ],
    });
    await runAccountSync("acc1", fakeStep().step, deps);

    expect(fetchPage.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ["tourist", START_CURSOR],
      ["tourist", START_CURSOR],
    ]);
    expect(deps.applySnapshot).toHaveBeenCalledWith(
      { accountId: "acc1", userId: "u1", platform: "codeforces" },
      EMPTY,
    );
  });

  it("finishes with the last reported cursor and the summed item count", async () => {
    const c1: SyncCursor = { platform: "codeforces", maxSubmissionId: 20 };
    const { deps } = fakeDeps({ pages: [page(1, c1), page(null, null)], inserted: 5 });
    await runAccountSync("acc1", fakeStep().step, deps);

    expect(deps.finishAccountSync).toHaveBeenCalledWith({
      accountId: "acc1",
      runId: 7,
      cursor: c1,
      items: 10,
      history: "full",
      historyComplete: false,
    });
  });

  it("keeps the start cursor when no page reports one", async () => {
    const { deps } = fakeDeps({ pages: [page(null, null)] });
    await runAccountSync("acc1", fakeStep().step, deps);
    expect(deps.finishAccountSync).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: START_CURSOR }),
    );
  });

  it("skips a removed account without running any page step", async () => {
    const { deps, fetchPage } = fakeDeps({ pages: [], account: null });
    const { step, runs, sleeps } = fakeStep();

    expect(await runAccountSync("gone", step, deps)).toEqual({ skipped: true });
    expect(runs).toEqual(["start"]);
    expect(sleeps).toEqual([]);
    expect(fetchPage).not.toHaveBeenCalled();
    expect(deps.finishAccountSync).not.toHaveBeenCalled();
  });

  it("gives up after the page cap", async () => {
    const endless: SyncPage = page(1, null);
    const { deps, fetchPage } = fakeDeps({ pages: [] });
    fetchPage.mockResolvedValue(endless);
    const { step, runs } = fakeStep();

    await expect(runAccountSync("acc1", step, deps)).rejects.toMatchObject({
      name: "NonRetriableError",
    });
    expect(runs.filter((id) => id.startsWith("page-"))).toHaveLength(MAX_SYNC_PAGES);
    expect(deps.finishAccountSync).not.toHaveBeenCalled();
  });

  it("propagates an adapter error so Inngest can retry and run onFailure", async () => {
    const { deps, fetchPage } = fakeDeps({ pages: [] });
    fetchPage.mockRejectedValue(new Error("Codeforces is down"));

    await expect(runAccountSync("acc1", fakeStep().step, deps)).rejects.toThrow(
      "Codeforces is down",
    );
    expect(deps.applySnapshot).not.toHaveBeenCalled();
    expect(deps.finishAccountSync).not.toHaveBeenCalled();
  });

  it("fails a missing handle without retries", async () => {
    const { deps, fetchPage } = fakeDeps({ pages: [] });
    fetchPage.mockRejectedValue(new PlatformUserNotFoundError('No LeetCode user named "x".'));

    const err = await runAccountSync("acc1", fakeStep().step, deps).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NonRetriableError);
    expect((err as Error).message).toBe('No LeetCode user named "x".');
  });
});
