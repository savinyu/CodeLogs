import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sleeps: number[] = [];
vi.mock("../extension/lib/common.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../extension/lib/common.js")>();
  return {
    ...actual,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
  };
});

import { ReaderError, ThrottledError } from "../extension/lib/common.js";
import { runLeetcodeJob } from "../extension/lib/leetcode-job.js";
import { codechef } from "../extension/lib/platforms/codechef.js";
import { hackerrank } from "../extension/lib/platforms/hackerrank.js";
import { fakePage } from "./extension-helpers";

// ---- LeetCode date walk ----

// The extension has no chrome typings; the job under test only calls chrome.permissions.
declare global {
  const chrome: { permissions: { contains: (q: { origins: string[] }) => Promise<boolean> } };
}

type Sub = { status_display: string; title_slug: string; timestamp: number };
type SubsReply = { status: number; body?: unknown };

/**
 * Stubs fetch for LogN and leetcode.com; `subs(n)` answers the n-th submissions request and `me`
 * is /api/extension/me.
 */
function stubLeetcode(subs: (n: number) => SubsReply, me: unknown = { username: "u" }) {
  let n = 0;
  let uploaded: { solves: Array<{ solvedAt: number | null }>; manual?: boolean } | null = null;
  let leetcodeRequests = 0;
  vi.stubGlobal("chrome", { permissions: { contains: async () => true } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      const json = (status: number, body: unknown) =>
        ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
      if (url.endsWith("/api/extension/me")) return json(200, me);
      if (url.endsWith("/api/extension/leetcode")) {
        uploaded = JSON.parse(String(init?.body));
        return json(200, { ok: true, imported: 1, alreadyKnown: 0, complete: true });
      }
      leetcodeRequests++;
      if (url.includes("/api/problems/all/")) {
        return json(200, {
          user_name: "me",
          stat_status_pairs: [{ status: "ac", stat: { question__title_slug: "two-sum" } }],
        });
      }
      const r = subs(n++);
      return json(r.status, r.body);
    }),
  );
  return {
    uploaded: () => uploaded,
    submissionRequests: () => n,
    leetcodeRequests: () => leetcodeRequests,
  };
}

const page = (hasNext: boolean, ts: number): SubsReply => ({
  status: 200,
  body: {
    has_next: hasNext,
    last_key: "k",
    submissions_dump: [
      { status_display: "Accepted", title_slug: "two-sum", timestamp: ts } satisfies Sub,
    ],
  },
});

const run = (datesSince: number | null = null, manual = true) =>
  runLeetcodeJob({
    base: "https://x.test",
    token: "t",
    includeDates: true,
    datesSince,
    manual,
    setStatus: async () => {},
  });

describe("LeetCode removed on LogN", () => {
  afterEach(() => vi.unstubAllGlobals());
  const removed = { username: "u", handles: {}, removed: ["leetcode"] };

  it("an automatic run reads nothing from leetcode.com", async () => {
    const lc = stubLeetcode(() => page(false, 1700000000), removed);
    expect(await run(null, false)).toMatchObject({ skipped: true });
    expect(lc.leetcodeRequests()).toBe(0);
    expect(lc.uploaded()).toBeNull();
  });

  it("a click syncs it and tells LogN it was a click", async () => {
    const lc = stubLeetcode(() => page(false, 1700000000), removed);
    await run(null, true);
    expect(lc.uploaded()?.manual).toBe(true);
  });

  it("an automatic run of a platform that wasn't removed says so too", async () => {
    const lc = stubLeetcode(() => page(false, 1700000000));
    await run(null, false);
    expect(lc.uploaded()?.manual).toBe(false);
  });
});

describe("LeetCode date walk", () => {
  beforeEach(() => {
    sleeps.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("pauses before the first submissions request", async () => {
    stubLeetcode(() => page(false, 1700000000));
    await run();
    expect(sleeps[0]).toBe(1500);
  });

  it("resets the back-off budget after a good page", async () => {
    // Three throttles in the walk, never more than two in a row: the old counter gave up.
    const replies: SubsReply[] = [
      { status: 429 },
      { status: 429 },
      page(true, 1700000300),
      { status: 429 },
      { status: 429 },
      page(true, 1700000200),
      { status: 429 },
      page(false, 1700000100),
    ];
    const s = stubLeetcode((n) => replies[n] ?? { status: 500 });
    const out = await run();
    expect(out.datesDone).toBe(true);
    expect(out.datesNote).toBe("");
    expect(s.uploaded()?.solves[0]?.solvedAt).not.toBeNull();
  });

  it("keeps the partial dates when throttled out after a good page, and says so", async () => {
    const replies: SubsReply[] = [page(true, 1700000300), ...Array(3).fill({ status: 429 })];
    const s = stubLeetcode((n) => replies[n] ?? { status: 429 });
    const out = await run();
    expect(out.datesDone).toBe(false);
    expect(out.datesNote).toMatch(/stopped early/);
    expect(s.uploaded()?.solves[0]?.solvedAt).not.toBeNull();
  });

  it("returns no dates when nothing could be read", async () => {
    stubLeetcode(() => ({ status: 500 }));
    const out = await run();
    expect(out.datesDone).toBe(false);
    expect(out.datesNote).toMatch(/unavailable/);
  });

  it("flags the page cap", async () => {
    const s = stubLeetcode(() => page(true, 1700000000));
    const out = await run();
    expect(s.submissionRequests()).toBe(400);
    expect(out.datesDone).toBe(false);
    expect(out.datesNote).toMatch(/400 pages/);
  });

  it("counts reaching back past `since` as a completed walk", async () => {
    stubLeetcode(() => page(true, 1700000000));
    const out = await run(1700000500);
    expect(out.datesDone).toBe(true);
  });
});

// ---- HackerRank paging ----

describe("HackerRank paging", () => {
  const rows = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      status: "Accepted",
      challenge: { name: `C${from + i}`, slug: `c${from + i}` },
      created_at: 1700000000 + from + i,
    }));
  const histories = { match: "submission_histories", data: {} };

  it("follows a server that caps pages at 10 rows (total 25) to the end", async () => {
    const page = fakePage({
      identity: ["h"],
      routes: [
        { match: "/badges", status: 404 },
        histories,
        { match: "offset=0&", data: { models: rows(0, 10), total: 25 } },
        { match: "offset=10&", data: { models: rows(10, 10), total: 25 } },
        { match: "offset=20&", data: { models: rows(20, 5), total: 25 } },
      ],
    });
    const upload = await hackerrank.read(page.context(hackerrank));
    const urls = page.requests.map((r) => r.url).filter((u) => u.includes("/submissions/"));
    expect(urls).toHaveLength(3);
    expect(upload.solves).toHaveLength(25);
    expect(upload.listComplete).toBe(true);
  });

  it("with no total, a short page is the end of the list", async () => {
    const page = fakePage({
      identity: ["h"],
      routes: [
        { match: "/badges", status: 404 },
        histories,
        { match: "offset=0&", data: { models: rows(0, 10) } },
      ],
    });
    const upload = await hackerrank.read(page.context(hackerrank));
    expect(upload.solves).toHaveLength(10);
    expect(upload.listComplete).toBe(true);
  });

  it("stops on an empty page", async () => {
    const page = fakePage({
      identity: ["h"],
      routes: [
        { match: "/badges", status: 404 },
        histories,
        { match: "offset=0&", data: { models: rows(0, 10), total: 99 } },
        { match: "offset=10&", data: { models: [], total: 99 } },
      ],
    });
    const upload = await hackerrank.read(page.context(hackerrank));
    expect(upload.solves).toHaveLength(10);
    expect(upload.listComplete).toBe(true);
  });

  it("uploads what it read, incomplete, when throttled after the first page", async () => {
    const page = fakePage({
      identity: ["h"],
      routes: [
        { match: "/badges", status: 404 },
        histories,
        { match: "offset=0&", data: { models: rows(0, 50), total: 120 } },
        { match: "offset=50&", status: 429 },
      ],
    });
    const upload = await hackerrank.read(page.context(hackerrank));
    expect(upload.solves).toHaveLength(50);
    expect(upload.listComplete).toBe(false);
  });

  it("still fails the job when the first page is throttled", async () => {
    const page = fakePage({
      identity: ["h"],
      routes: [{ match: "/badges", status: 404 }, histories, { match: "offset=0&", status: 429 }],
    });
    const err = await hackerrank.read(page.context(hackerrank)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ThrottledError);
    expect(err).toBeInstanceOf(ReaderError);
  });
});

describe("CodeChef throttle", () => {
  it("fails the job when the first page is throttled", async () => {
    const page = fakePage({
      identity: ["h"],
      routes: [
        { match: "/users/", data: "" },
        { match: "/recent/user", status: 429 },
      ],
    });
    const err = await codechef.read(page.context(codechef)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ReaderError);
  });
});
