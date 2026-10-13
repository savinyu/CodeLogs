import { afterEach, describe, expect, it, vi } from "vitest";
import { atcoderAdapter, atcoderCatalog } from "@/lib/adapters/atcoder";
import { loadFixture, mockHttp } from "../helpers/mock-http";

afterEach(() => vi.restoreAllMocks());

interface Row {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  result: string;
}

const SUBMISSIONS = "kenkoooo.com/atcoder/atcoder-api/v3/user/submissions";
const profile = loadFixture<{ html: string }>("atcoder/profile-chokudai.json").html;

function row(id: number, second: number, problem: string, result = "AC"): Row {
  return {
    id,
    epoch_second: second,
    problem_id: problem,
    contest_id: problem.split("_")[0] ?? problem,
    result,
  };
}

/** n rows, one distinct problem each, seconds start..start+n-1. */
function fullPage(start: number, n = 500): Row[] {
  return Array.from({ length: n }, (_, i) => row(i + 1, start + i, `abc${100 + i}_a`));
}

describe("atcoderAdapter metadata", () => {
  it("declares platform, pacing and capabilities", () => {
    expect(atcoderAdapter.platform).toBe("atcoder");
    expect(atcoderAdapter.minDelayMs).toBe(1100);
    expect(atcoderAdapter.capabilities).toEqual({
      history: "full",
      topicTags: false,
      topicCounts: false,
      activityCalendar: false,
    });
  });
});

describe("fetchPage", () => {
  it("starts at from_second=0 with a null cursor and a null page", async () => {
    const http = mockHttp([
      { match: SUBMISSIONS, json: loadFixture("atcoder/submissions-page.json") },
    ]);
    await atcoderAdapter.fetchPage("chokudai", null, null);
    expect(http.calls).toHaveLength(1);
    const url = new URL(http.calls[0]!.url);
    expect(url.searchParams.get("user")).toBe("chokudai");
    expect(url.searchParams.get("from_second")).toBe("0");
  });

  it("keeps only AC rows, deduped by problem with the earliest timestamp", async () => {
    mockHttp([{ match: SUBMISSIONS, json: loadFixture("atcoder/submissions-page.json") }]);
    const page = await atcoderAdapter.fetchPage("chokudai", null, null);
    const ids = page.snapshot.solves.map((s) => s.externalProblemId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(30); // 33 AC rows, 30 distinct problems
    const arc001_2 = page.snapshot.solves.find((s) => s.externalProblemId === "arc001_2");
    expect(arc001_2?.firstSolvedAt).toEqual(new Date(1344512799 * 1000)); // not the later 1344513118
    expect(page.snapshot.solves.every((s) => s.platform === "atcoder")).toBe(true);
    expect(page.snapshot.extras).toEqual([]);
  });

  it("ignores non-AC results and picks the earliest AC even if rows are out of order", async () => {
    mockHttp([
      {
        match: SUBMISSIONS,
        json: [
          row(1, 100, "abc001_a", "WA"),
          row(2, 300, "abc001_b", "AC"),
          row(3, 200, "abc001_b", "AC"),
          row(4, 400, "abc001_c", "TLE"),
        ],
      },
    ]);
    const page = await atcoderAdapter.fetchPage("u", null, null);
    expect(page.snapshot.solves).toHaveLength(1);
    expect(page.snapshot.solves[0]).toMatchObject({
      externalProblemId: "abc001_b",
      firstSolvedAt: new Date(200_000),
    });
  });

  it("builds a fallback with the task URL and the problem id as title", async () => {
    mockHttp([
      {
        match: SUBMISSIONS,
        json: [row(1, 100, "tenka1_2012_qualA_4")].map((r) => ({
          ...r,
          contest_id: "tenka1-2012-qualA",
        })),
      },
    ]);
    const page = await atcoderAdapter.fetchPage("u", null, null);
    expect(page.snapshot.solves[0]?.problemFallback).toEqual({
      title: "tenka1_2012_qualA_4",
      url: "https://atcoder.jp/contests/tenka1-2012-qualA/tasks/tenka1_2012_qualA_4",
      rawTags: [],
    });
  });

  it("skips malformed rows instead of crashing", async () => {
    mockHttp([
      {
        match: SUBMISSIONS,
        json: [null, "x", { problem_id: "abc001_a" }, { epoch_second: 5 }, row(1, 100, "abc001_a")],
      },
    ]);
    const page = await atcoderAdapter.fetchPage("u", null, null);
    expect(page.snapshot.solves.map((s) => s.externalProblemId)).toEqual(["abc001_a"]);
  });

  it("full page: nextPage is the last (inclusive) second, resumeCursor too", async () => {
    mockHttp([{ match: SUBMISSIONS, json: fullPage(1000) }]);
    const page = await atcoderAdapter.fetchPage("u", null, null);
    expect(page.snapshot.solves).toHaveLength(500);
    expect(page.nextPage).toBe(1499);
    expect(page.resumeCursor).toEqual({ platform: "atcoder", fromSecond: 1499 });
  });

  it("uses the page token as from_second for follow-up pages", async () => {
    const http = mockHttp([{ match: SUBMISSIONS, json: fullPage(1499) }]);
    const page = await atcoderAdapter.fetchPage("u", { platform: "atcoder", fromSecond: 50 }, 1499);
    expect(new URL(http.calls[0]!.url).searchParams.get("from_second")).toBe("1499");
    expect(page.nextPage).toBe(1998);
  });

  it("stall guard: a full page within one second does not advance", async () => {
    const stuck = Array.from({ length: 500 }, (_, i) => row(i + 1, 777, `abc${i}_a`));
    mockHttp([{ match: SUBMISSIONS, json: stuck }]);
    const page = await atcoderAdapter.fetchPage("u", null, 777);
    expect(page.nextPage).toBeNull();
    expect(page.resumeCursor).toEqual({ platform: "atcoder", fromSecond: 777 });
  });

  it("short page: nextPage is null", async () => {
    mockHttp([{ match: SUBMISSIONS, json: fullPage(1000, 499) }]);
    const page = await atcoderAdapter.fetchPage("u", null, null);
    expect(page.nextPage).toBeNull();
    expect(page.resumeCursor).toEqual({ platform: "atcoder", fromSecond: 1498 });
  });

  it("empty page: no solves, nextPage and resumeCursor are null", async () => {
    mockHttp([{ match: SUBMISSIONS, json: loadFixture("atcoder/submissions-empty.json") }]);
    const page = await atcoderAdapter.fetchPage("nobody", null, null);
    expect(page.snapshot.solves).toEqual([]);
    expect(page.nextPage).toBeNull();
    expect(page.resumeCursor).toBeNull();
  });

  it("uses the cursor's fromSecond when page is null", async () => {
    const http = mockHttp([{ match: SUBMISSIONS, json: [] }]);
    await atcoderAdapter.fetchPage("u", { platform: "atcoder", fromSecond: 1234567 }, null);
    expect(new URL(http.calls[0]!.url).searchParams.get("from_second")).toBe("1234567");
  });

  it("ignores a cursor from another platform", async () => {
    const http = mockHttp([{ match: SUBMISSIONS, json: [] }]);
    await atcoderAdapter.fetchPage("u", { platform: "codeforces", maxSubmissionId: 9 }, null);
    expect(new URL(http.calls[0]!.url).searchParams.get("from_second")).toBe("0");
  });

  it("URL-encodes the handle", async () => {
    const http = mockHttp([{ match: SUBMISSIONS, json: [] }]);
    await atcoderAdapter.fetchPage("a&b=c", null, null);
    expect(new URL(http.calls[0]!.url).searchParams.get("user")).toBe("a&b=c");
  });
});

describe("validateHandle", () => {
  it("returns valid with AtCoder's own casing of the handle", async () => {
    const http = mockHttp([{ match: "atcoder.jp/users/", text: profile }]);
    const res = await atcoderAdapter.validateHandle("CHOKUDAI");
    expect(res).toEqual({ result: "valid", canonicalHandle: "chokudai" });
    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]!.url).toBe("https://atcoder.jp/users/CHOKUDAI");
  });

  it("falls back to the input when the page can't be parsed", async () => {
    mockHttp([{ match: "atcoder.jp/users/", text: "<html>weird</html>" }]);
    expect(await atcoderAdapter.validateHandle("Someone")).toEqual({
      result: "valid",
      canonicalHandle: "Someone",
    });
  });

  it("returns invalid on 404", async () => {
    mockHttp([
      { match: "atcoder.jp/users/", status: 404, text: "<title>404 Not Found - AtCoder</title>" },
    ]);
    expect(await atcoderAdapter.validateHandle("nobody_here")).toEqual({
      result: "invalid",
      message: 'No AtCoder user named "nobody_here".',
    });
  });

  it("returns retry on persistent 503", async () => {
    mockHttp([{ match: "atcoder.jp/users/", status: 503, text: "down" }]);
    const res = await atcoderAdapter.validateHandle("chokudai");
    expect(res.result).toBe("retry");
  });

  it("returns retry on 429", async () => {
    mockHttp([{ match: "atcoder.jp/users/", status: 429, text: "slow down" }]);
    expect((await atcoderAdapter.validateHandle("chokudai")).result).toBe("retry");
  });

  it("returns retry (and does not throw) on network errors", async () => {
    mockHttp([{ match: "atcoder.jp/users/", error: new TypeError("fetch failed") }]);
    const res = await atcoderAdapter.validateHandle("chokudai");
    expect(res.result).toBe("retry");
  });
});

describe("readVerificationField", () => {
  it("reads the Affiliation cell", async () => {
    mockHttp([{ match: "atcoder.jp/users/chokudai", text: profile }]);
    expect(await atcoderAdapter.readVerificationField("chokudai")).toBe("AtCoder Inc. CEO");
  });

  it("decodes entities, strips tags and collapses whitespace", async () => {
    const html =
      '<table><tr><th class="no-break">Affiliation</th><td class="break-all">\n  R&amp;D &lt;Lab&gt; <b>&#x4e00;&#20108;</b> &quot;x&quot;  </td></tr></table>';
    mockHttp([{ match: "atcoder.jp/users/", text: html }]);
    expect(await atcoderAdapter.readVerificationField("u")).toBe('R&D <Lab> 一二 "x"');
  });

  it("returns null for an empty or missing Affiliation", async () => {
    mockHttp([
      { match: "users/empty", text: '<tr><th>Affiliation</th><td class="break-all"> </td></tr>' },
      { match: "users/missing", text: "<tr><th>Rating</th><td>1</td></tr>" },
    ]);
    expect(await atcoderAdapter.readVerificationField("empty")).toBeNull();
    expect(await atcoderAdapter.readVerificationField("missing")).toBeNull();
  });

  it("returns null on 404", async () => {
    mockHttp([{ match: "atcoder.jp/users/", status: 404, text: "not found" }]);
    expect(await atcoderAdapter.readVerificationField("nobody")).toBeNull();
  });
});

describe("atcoderCatalog.fetchCatalog", () => {
  it("joins problems with models; missing models and difficulties become undefined", async () => {
    const http = mockHttp([
      {
        match: "resources/problem-models.json",
        json: loadFixture("atcoder/problem-models-sample.json"),
      },
      { match: "resources/problems.json", json: loadFixture("atcoder/problems-sample.json") },
    ]);
    const catalog = await atcoderCatalog.fetchCatalog();
    expect(http.calls).toHaveLength(2);
    expect(catalog).toHaveLength(31);

    const byId = new Map(catalog.map((p) => [p.externalId, p]));
    expect(byId.get("abc004_4")).toEqual({
      platform: "atcoder",
      externalId: "abc004_4",
      title: "マーブル",
      url: "https://atcoder.jp/contests/abc004/tasks/abc004_4",
      difficultyRaw: 1861,
      rawTags: [],
    });
    expect(byId.get("arc002_1")?.difficultyRaw).toBe(-381); // negative kept raw
    expect(byId.get("arc001_1")?.difficultyRaw).toBeUndefined(); // model without difficulty
    expect(byId.get("utpc2012_05")?.difficultyRaw).toBeUndefined(); // no model at all
  });

  it("falls back to title, then id, when name is missing", async () => {
    mockHttp([
      {
        match: "problems.json",
        json: [
          { id: "a_1", contest_id: "a", title: "A. T" },
          { id: "b_1", contest_id: "b" },
          { nope: true },
        ],
      },
      { match: "problem-models.json", json: {} },
    ]);
    const catalog = await atcoderCatalog.fetchCatalog();
    expect(catalog.map((p) => p.title)).toEqual(["A. T", "b_1"]);
  });
});
