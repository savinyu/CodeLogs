import { PlatformUserNotFoundError } from "@/lib/adapters/errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { codeforcesAdapter, codeforcesCatalog } from "@/lib/adapters/codeforces";
import { HttpError, isRetryableError } from "@/lib/adapters/http";
import type { SyncCursor } from "@/lib/adapters/types";
import { loadFixture, mockHttp } from "../helpers/mock-http";

afterEach(() => vi.restoreAllMocks());

interface Sub {
  id: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: { contestId?: number; index: string; name: string; rating?: number; tags?: string[] };
}
interface StatusFixture {
  status: string;
  result: Sub[];
}
interface ErrorFixture {
  httpStatus: number;
  body: unknown;
}

const status = loadFixture<StatusFixture>("codeforces/user-status.json");
const userInfo = loadFixture("codeforces/user-info.json");
const unknownHandle = loadFixture<ErrorFixture>("codeforces/error-unknown-handle.json");
const ratingFixture = loadFixture("codeforces/user-rating.json");
const catalogFixture = loadFixture("codeforces/problemset-sample.json");

const NEWEST_ID = Math.max(...status.result.map((s) => s.id));

function sub(id: number, verdict: string, index = "A", contestId = 1000, time = id): Sub {
  return {
    id,
    creationTimeSeconds: time,
    verdict,
    problem: { contestId, index, name: `P${contestId}${index}`, rating: 800, tags: ["math"] },
  };
}

/** `count` rows with ids descending from `top`, each a distinct problem (OK unless overridden). */
function rows(top: number, count: number, verdict = "OK"): Sub[] {
  return Array.from({ length: count }, (_, i) =>
    sub(top - i, verdict, `P${i}`, 2000 + Math.floor(i / 5)),
  );
}

const cursor = (maxSubmissionId: number): SyncCursor => ({
  platform: "codeforces",
  maxSubmissionId,
});

describe("codeforcesAdapter metadata", () => {
  it("declares the contract values", () => {
    expect(codeforcesAdapter.platform).toBe("codeforces");
    expect(codeforcesAdapter.minDelayMs).toBe(2000);
    expect(codeforcesAdapter.capabilities).toEqual({
      history: "full",
      topicTags: true,
      topicCounts: false,
      activityCalendar: false,
    });
  });
});

describe("fetchPage", () => {
  it("page null: user.info -> cf_rating extra, nextPage 0", async () => {
    const http = mockHttp([{ match: "user.info", json: userInfo }]);
    const page = await codeforcesAdapter.fetchPage("savinyu", null, null);
    expect(page.snapshot.solves).toEqual([]);
    expect(page.snapshot.extras).toEqual([
      {
        kind: "cf_rating",
        payload: { rating: 839, maxRating: 1062, rank: "newbie", maxRank: "newbie" },
      },
    ]);
    expect(page.nextPage).toBe(0);
    expect(page.resumeCursor).toBeNull();
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]?.url).toBe("https://codeforces.com/api/user.info?handles=savinyu");
  });

  it("page null: unrated user gives null rating fields", async () => {
    mockHttp([
      { match: "user.info", json: { status: "OK", result: [{ handle: "fresh", firstName: "F" }] } },
    ]);
    const page = await codeforcesAdapter.fetchPage("fresh", null, null);
    expect(page.snapshot.extras[0]?.payload).toEqual({
      rating: null,
      maxRating: null,
      rank: null,
      maxRank: null,
    });
  });

  it("page null: unknown handle throws a clear error", async () => {
    mockHttp([{ match: "user.info", status: unknownHandle.httpStatus, json: unknownHandle.body }]);
    const err = codeforcesAdapter.fetchPage("nobody", null, null);
    await expect(err).rejects.toThrow(/"nobody" not found/);
    await expect(err).rejects.toBeInstanceOf(PlatformUserNotFoundError);
  });

  it("page 0: user.rating -> 20 contests, nextPage 1, no solves", async () => {
    const http = mockHttp([{ match: "user.rating", json: ratingFixture }]);
    const page = await codeforcesAdapter.fetchPage("savinyu", null, 0);
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]?.url).toBe("https://codeforces.com/api/user.rating?handle=savinyu");
    expect(page.snapshot.solves).toEqual([]);
    expect(page.snapshot.extras).toEqual([]);
    const contests = page.snapshot.contests ?? [];
    expect(contests).toHaveLength(20);
    expect(contests[0]).toEqual({
      contestKey: "1782",
      name: "Codeforces Round 844 (Div. 1 + Div. 2, based on VK Cup 2022 - Elimination Round)",
      heldAt: new Date(1673795100 * 1000),
      rank: 8122,
      oldRating: 0,
      newRating: 369,
      rated: true,
    });
    expect(contests[0]?.heldAt).toBeInstanceOf(Date);
    const last = contests[19];
    expect(last?.contestKey).toBe("1842");
    expect(last?.name).toBe("CodeTON Round 5 (Div. 1 + Div. 2, Rated, Prizes!)");
    expect(last?.rank).toBe(10469);
    expect(last?.oldRating).toBe(946);
    expect(last?.newRating).toBe(839);
    expect(last?.rated).toBe(true);
    expect(last?.heldAt).toBeInstanceOf(Date);
    expect(page.nextPage).toBe(1);
    expect(page.resumeCursor).toBeNull();
  });

  it("page 0: also runs on incremental syncs", async () => {
    const http = mockHttp([{ match: "user.rating", json: ratingFixture }]);
    const page = await codeforcesAdapter.fetchPage("savinyu", cursor(500), 0);
    expect(http.calls).toHaveLength(1);
    expect(page.snapshot.contests).toHaveLength(20);
    expect(page.nextPage).toBe(1);
  });

  it("page 0: no rated contests gives contests: [] (not undefined)", async () => {
    mockHttp([{ match: "user.rating", json: { status: "OK", result: [] } }]);
    const page = await codeforcesAdapter.fetchPage("fresh", null, 0);
    expect(page.snapshot.contests).toEqual([]);
    expect(page.nextPage).toBe(1);
  });

  it("page 0: dedupes by contestKey, keeping the first", async () => {
    const row = (name: string, newRating: number) => ({
      contestId: 7,
      contestName: name,
      handle: "h",
      rank: 1,
      ratingUpdateTimeSeconds: 100,
      oldRating: 0,
      newRating,
    });
    mockHttp([
      { match: "user.rating", json: { status: "OK", result: [row("first", 10), row("dup", 20)] } },
    ]);
    const page = await codeforcesAdapter.fetchPage("h", null, 0);
    expect(page.snapshot.contests?.map((c) => c.name)).toEqual(["first"]);
  });

  it("page 0: unknown handle throws PlatformUserNotFoundError", async () => {
    mockHttp([
      {
        match: "user.rating",
        status: 400,
        json: { status: "FAILED", comment: "handle: User zzzz not found" },
      },
    ]);
    const err = codeforcesAdapter.fetchPage("zzzz", null, 0);
    await expect(err).rejects.toBeInstanceOf(PlatformUserNotFoundError);
  });

  it("page 0: 503 is a retryable HttpError", async () => {
    mockHttp([{ match: "user.rating", status: 503, text: "Service Unavailable" }]);
    const err = await codeforcesAdapter.fetchPage("h", null, 0).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(isRetryableError(err)).toBe(true);
  });

  it("page 0: a call limit that never clears is retryable", async () => {
    mockHttp([
      {
        match: "user.rating",
        status: 400,
        json: { status: "FAILED", comment: "Call limit exceeded" },
      },
    ]);
    const err = await codeforcesAdapter.fetchPage("h", null, 0).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(isRetryableError(err)).toBe(true);
  });

  it("first sync: whole history in one call, 46 unique solves, one request without from/count", async () => {
    const http = mockHttp([{ match: "user.status", json: status }]);
    const page = await codeforcesAdapter.fetchPage("savinyu", null, 1);
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]?.url).toBe("https://codeforces.com/api/user.status?handle=savinyu");
    expect(page.snapshot.solves).toHaveLength(46);
    expect(new Set(page.snapshot.solves.map((s) => s.externalProblemId)).size).toBe(46);
    expect(page.nextPage).toBeNull();
    expect(page.resumeCursor).toEqual({ platform: "codeforces", maxSubmissionId: NEWEST_ID });
  });

  it("first sync: 1782A is present with an inline fallback", async () => {
    mockHttp([{ match: "user.status", json: status }]);
    const page = await codeforcesAdapter.fetchPage("savinyu", null, 1);
    const solve = page.snapshot.solves.find((s) => s.externalProblemId === "1782A");
    expect(solve).toBeDefined();
    expect(solve?.platform).toBe("codeforces");
    expect(solve?.problemFallback).toMatchObject({
      url: "https://codeforces.com/problemset/problem/1782/A",
    });
    expect(solve?.problemFallback?.title).toBeTruthy();
    expect(Array.isArray(solve?.problemFallback?.rawTags)).toBe(true);
    expect(solve?.firstSolvedAt).toBeInstanceOf(Date);
  });

  it("first sync: re-solved problem keeps the earliest timestamp (231A)", async () => {
    mockHttp([{ match: "user.status", json: status }]);
    const page = await codeforcesAdapter.fetchPage("savinyu", null, 1);
    const times = status.result
      .filter((s) => s.verdict === "OK" && `${s.problem.contestId}${s.problem.index}` === "231A")
      .map((s) => s.creationTimeSeconds);
    expect(times.length).toBeGreaterThan(1);
    const solve = page.snapshot.solves.find((s) => s.externalProblemId === "231A");
    expect(solve?.firstSolvedAt?.getTime()).toBe(Math.min(...times) * 1000);
  });

  it("first sync: only OK verdicts count, and the cursor spans all verdicts", async () => {
    mockHttp([
      {
        match: "user.status",
        json: { status: "OK", result: [sub(9, "WA", "B"), sub(5, "OK", "A"), sub(3, "TLE", "C")] },
      },
    ]);
    const page = await codeforcesAdapter.fetchPage("h", null, 1);
    expect(page.snapshot.solves.map((s) => s.externalProblemId)).toEqual(["1000A"]);
    expect(page.resumeCursor).toEqual(cursor(9));
  });

  it("first sync: no submissions gives no cursor", async () => {
    mockHttp([{ match: "user.status", json: { status: "OK", result: [] } }]);
    const page = await codeforcesAdapter.fetchPage("h", null, 1);
    expect(page.snapshot.solves).toEqual([]);
    expect(page.resumeCursor).toBeNull();
    expect(page.nextPage).toBeNull();
  });

  it("skips problems without contestId and builds gym URLs", async () => {
    const noContest: Sub = {
      id: 12,
      creationTimeSeconds: 12,
      verdict: "OK",
      problem: { index: "Z", name: "No contest" },
    };
    mockHttp([
      {
        match: "user.status",
        json: {
          status: "OK",
          result: [noContest, sub(11, "OK", "C", 102_001), sub(10, "OK", "A")],
        },
      },
    ]);
    const page = await codeforcesAdapter.fetchPage("h", null, 1);
    expect(page.snapshot.solves.map((s) => s.externalProblemId)).toEqual(["102001C", "1000A"]);
    expect(page.snapshot.solves[0]?.problemFallback?.url).toBe(
      "https://codeforces.com/gym/102001/problem/C",
    );
  });

  it("incremental: a full page of new rows asks for the next offset", async () => {
    const http = mockHttp([
      { match: "user.status", json: { status: "OK", result: rows(1000, 50) } },
    ]);
    const page = await codeforcesAdapter.fetchPage("h", cursor(500), 1);
    expect(http.calls[0]?.url).toBe(
      "https://codeforces.com/api/user.status?handle=h&from=1&count=50",
    );
    expect(page.snapshot.solves).toHaveLength(50);
    expect(page.nextPage).toBe(51);
    expect(page.resumeCursor).toEqual(cursor(1000));
  });

  it("incremental: stops at the cursor, keeps only newer rows", async () => {
    // ids 1000..951; cursor 960 -> 40 new rows (1000..961), 10 old.
    mockHttp([{ match: "user.status", json: { status: "OK", result: rows(1000, 50) } }]);
    const page = await codeforcesAdapter.fetchPage("h", cursor(960), 1);
    expect(page.snapshot.solves).toHaveLength(40);
    expect(page.nextPage).toBeNull();
    expect(page.resumeCursor).toEqual(cursor(1000));
  });

  it("incremental: a short page ends paging even if every row is new", async () => {
    mockHttp([{ match: "user.status", json: { status: "OK", result: rows(1000, 7) } }]);
    const page = await codeforcesAdapter.fetchPage("h", cursor(10), 1);
    expect(page.snapshot.solves).toHaveLength(7);
    expect(page.nextPage).toBeNull();
  });

  it("incremental: later pages use their offset and report no cursor", async () => {
    const http = mockHttp([
      { match: "user.status", json: { status: "OK", result: rows(900, 50) } },
    ]);
    const page = await codeforcesAdapter.fetchPage("h", cursor(100), 51);
    expect(http.calls[0]?.url).toContain("from=51&count=50");
    expect(page.nextPage).toBe(101);
    expect(page.resumeCursor).toBeNull();
  });

  it("incremental: nothing new gives no solves and no cursor", async () => {
    mockHttp([{ match: "user.status", json: { status: "OK", result: rows(1000, 50) } }]);
    const page = await codeforcesAdapter.fetchPage("h", cursor(1000), 1);
    expect(page.snapshot.solves).toEqual([]);
    expect(page.nextPage).toBeNull();
    expect(page.resumeCursor).toBeNull();
  });

  it("incremental: new non-OK submissions still advance the cursor", async () => {
    mockHttp([
      { match: "user.status", json: { status: "OK", result: [sub(20, "WA"), sub(5, "OK")] } },
    ]);
    const page = await codeforcesAdapter.fetchPage("h", cursor(10), 1);
    expect(page.snapshot.solves).toEqual([]);
    expect(page.resumeCursor).toEqual(cursor(20));
  });

  it("incremental: the cursor stops below the oldest pending submission", async () => {
    mockHttp([
      {
        match: "user.status",
        json: {
          status: "OK",
          result: [
            { ...sub(30, "OK"), verdict: undefined },
            sub(25, "TESTING"),
            sub(20, "OK", "B"),
            sub(15, "WA"),
          ],
        },
      },
    ]);
    const page = await codeforcesAdapter.fetchPage("h", cursor(10), 1);
    expect(page.resumeCursor).toEqual(cursor(20));
  });

  it("incremental: all-pending new rows keep the old cursor", async () => {
    mockHttp([{ match: "user.status", json: { status: "OK", result: [sub(30, "TESTING")] } }]);
    const page = await codeforcesAdapter.fetchPage("h", cursor(10), 1);
    expect(page.resumeCursor).toBeNull();
  });

  it("first sync: the cursor stops below a pending submission", async () => {
    mockHttp([
      {
        match: "user.status",
        json: {
          status: "OK",
          result: [{ ...sub(9, "OK"), verdict: undefined }, sub(8, "OK", "B"), sub(7, "WA")],
        },
      },
    ]);
    const page = await codeforcesAdapter.fetchPage("h", null, 1);
    expect(page.resumeCursor).toEqual(cursor(8));
  });

  it("first sync: all-pending history gives no cursor", async () => {
    mockHttp([{ match: "user.status", json: { status: "OK", result: [sub(9, "TESTING")] } }]);
    const page = await codeforcesAdapter.fetchPage("h", null, 1);
    expect(page.resumeCursor).toBeNull();
  });

  it("retries after 'Call limit exceeded' and then succeeds", async () => {
    const http = mockHttp([
      {
        match: "user.status",
        status: 400,
        json: { status: "FAILED", comment: "Call limit exceeded" },
        times: 1,
      },
      { match: "user.status", json: status },
    ]);
    const page = await codeforcesAdapter.fetchPage("savinyu", null, 1);
    expect(http.calls).toHaveLength(2);
    expect(page.snapshot.solves).toHaveLength(46);
  });

  it("surfaces a retryable HttpError when the call limit never clears", async () => {
    mockHttp([
      {
        match: "user.status",
        status: 503,
        json: { status: "FAILED", comment: "Call limit exceeded" },
      },
    ]);
    const err = await codeforcesAdapter.fetchPage("h", null, 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(isRetryableError(err)).toBe(true);
  });

  it("throws on a FAILED envelope", async () => {
    mockHttp([
      { match: "user.status", status: 400, json: { status: "FAILED", comment: "handle: bad" } },
    ]);
    await expect(codeforcesAdapter.fetchPage("h", null, 1)).rejects.toThrow(/handle: bad/);
  });
});

describe("validateHandle", () => {
  it("valid: returns Codeforces' own casing", async () => {
    const http = mockHttp([{ match: "user.info", json: userInfo }]);
    await expect(codeforcesAdapter.validateHandle("SAVINYU")).resolves.toEqual({
      result: "valid",
      canonicalHandle: "savinyu",
    });
    expect(http.calls[0]?.url).toBe("https://codeforces.com/api/user.info?handles=SAVINYU");
  });

  it("invalid: 400 + FAILED", async () => {
    mockHttp([{ match: "user.info", status: unknownHandle.httpStatus, json: unknownHandle.body }]);
    await expect(codeforcesAdapter.validateHandle("zz9_nobody_here_qq")).resolves.toEqual({
      result: "invalid",
      message: 'No Codeforces user named "zz9_nobody_here_qq".',
    });
  });

  it("invalid: malformed handle is a 400 too", async () => {
    const bad = loadFixture<ErrorFixture>("codeforces/error-unknown-handle-valid-length.json");
    mockHttp([{ match: "user.info", status: bad.httpStatus, json: bad.body }]);
    const res = await codeforcesAdapter.validateHandle("ab");
    expect(res.result).toBe("invalid");
  });

  it("retry: persistent 503", async () => {
    mockHttp([{ match: "user.info", status: 503, text: "Service Unavailable" }]);
    const res = await codeforcesAdapter.validateHandle("savinyu");
    expect(res.result).toBe("retry");
  });

  it("retry: network error", async () => {
    mockHttp([{ match: "user.info", error: new TypeError("fetch failed") }]);
    const res = await codeforcesAdapter.validateHandle("savinyu");
    expect(res.result).toBe("retry");
  });

  it("retry: call limit that never clears (400 body)", async () => {
    mockHttp([
      {
        match: "user.info",
        status: 400,
        json: { status: "FAILED", comment: "Call limit exceeded" },
      },
    ]);
    const res = await codeforcesAdapter.validateHandle("savinyu");
    expect(res.result).toBe("retry");
  });

  it("valid after a transient call-limit response", async () => {
    const http = mockHttp([
      {
        match: "user.info",
        status: 503,
        json: { status: "FAILED", comment: "Call limit exceeded" },
        times: 1,
      },
      { match: "user.info", json: userInfo },
    ]);
    const res = await codeforcesAdapter.validateHandle("savinyu");
    expect(res.result).toBe("valid");
    expect(http.calls).toHaveLength(2);
  });
});

describe("readVerificationField", () => {
  it("returns the trimmed organization", async () => {
    mockHttp([
      {
        match: "user.info",
        json: { status: "OK", result: [{ handle: "h", organization: "  CL-abc123  " }] },
      },
    ]);
    await expect(codeforcesAdapter.readVerificationField("h")).resolves.toBe("CL-abc123");
  });

  it("returns the fixture's organization", async () => {
    mockHttp([{ match: "user.info", json: userInfo }]);
    await expect(codeforcesAdapter.readVerificationField("savinyu")).resolves.toBe("IIT Rookee");
  });

  it("returns null for empty or missing organization", async () => {
    mockHttp([
      { match: "user.info", json: { status: "OK", result: [{ handle: "h", organization: " " }] } },
    ]);
    await expect(codeforcesAdapter.readVerificationField("h")).resolves.toBeNull();
    vi.restoreAllMocks();
    mockHttp([{ match: "user.info", json: { status: "OK", result: [{ handle: "h" }] } }]);
    await expect(codeforcesAdapter.readVerificationField("h")).resolves.toBeNull();
  });
});

describe("codeforcesCatalog", () => {
  it("parses problemset.problems", async () => {
    const http = mockHttp([{ match: "problemset.problems", json: catalogFixture }]);
    const problems = await codeforcesCatalog.fetchCatalog();
    expect(http.calls[0]?.url).toBe("https://codeforces.com/api/problemset.problems");
    expect(codeforcesCatalog.platform).toBe("codeforces");
    expect(problems).toHaveLength(75);
    expect(problems[0]).toEqual({
      platform: "codeforces",
      externalId: "2275H",
      title: "A Problem to Warm Up the Eyebrows",
      url: "https://codeforces.com/problemset/problem/2275/H",
      difficultyRaw: undefined,
      rawTags: ["combinatorics", "dp", "math"],
    });
  });

  it("carries ratings, defaults missing tags, skips problems without contestId", async () => {
    mockHttp([
      {
        match: "problemset.problems",
        json: {
          status: "OK",
          result: {
            problems: [
              { contestId: 1, index: "A", name: "Rated", rating: 1200, tags: ["dp"] },
              { contestId: 2, index: "B", name: "Untagged" },
              { index: "C", name: "No contest" },
            ],
          },
        },
      },
    ]);
    const problems = await codeforcesCatalog.fetchCatalog();
    expect(problems.map((p) => p.externalId)).toEqual(["1A", "2B"]);
    expect(problems[0]?.difficultyRaw).toBe(1200);
    expect(problems[1]?.rawTags).toEqual([]);
  });

  it("throws when the API reports FAILED", async () => {
    mockHttp([
      { match: "problemset.problems", status: 400, json: { status: "FAILED", comment: "x" } },
    ]);
    await expect(codeforcesCatalog.fetchCatalog()).rejects.toThrow(/x/);
  });
});
