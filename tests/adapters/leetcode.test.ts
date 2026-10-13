import { PlatformUserNotFoundError } from "@/lib/adapters/errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError, httpRuntime } from "@/lib/adapters/http";
import { leetcodeAdapter, leetcodeCatalog } from "@/lib/adapters/leetcode";
import type { SyncCursor } from "@/lib/adapters/types";
import { loadFixture, mockHttp, type MockCall, type MockRoute } from "../helpers/mock-http";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const HANDLE = "CptDailyBird";

interface GqlBody {
  query: string;
  variables: Record<string, unknown>;
}

function parseBody(call: MockCall | undefined): GqlBody {
  if (!call?.body) throw new Error("call has no body");
  return JSON.parse(call.body) as GqlBody;
}

/** Route a GraphQL POST by a marker substring of its query text. */
function gqlRoute(marker: string, rest: Omit<MockRoute, "match">): MockRoute {
  return {
    match: (url, body) =>
      url.endsWith("/graphql") &&
      !!body &&
      parseBody({ url, method: "POST", body }).query.includes(marker),
    ...rest,
  };
}

const STATS = gqlRoute("allQuestionsCount", { json: loadFixture("leetcode/stats.json") });
const TAGS = gqlRoute("tagProblemCounts", { json: loadFixture("leetcode/tag-counts.json") });
const RECENT = gqlRoute("recentAcSubmissionList", { json: loadFixture("leetcode/recent-ac.json") });
const CAL_YEAR = gqlRoute("userCalendar(year", {
  json: loadFixture("leetcode/calendar-year.json"),
});
const CAL = gqlRoute("userCalendar", { json: loadFixture("leetcode/calendar.json") });
const UNKNOWN = loadFixture<{ body: unknown }>("leetcode/error-unknown-user.json").body;

const cursor = (lastAcceptedAt: number): SyncCursor => ({ platform: "leetcode", lastAcceptedAt });

describe("leetcodeAdapter metadata", () => {
  it("declares the platform contract", () => {
    expect(leetcodeAdapter.platform).toBe("leetcode");
    expect(leetcodeAdapter.minDelayMs).toBe(1000);
    expect(leetcodeAdapter.capabilities).toEqual({
      history: "recent_only",
      topicTags: true,
      topicCounts: true,
      activityCalendar: true,
    });
    expect(leetcodeCatalog.platform).toBe("leetcode");
  });
});

describe("fetchPage stats (token null / 0)", () => {
  it.each([null, 0])("page %s returns difficulty counts and advances to 1", async (page) => {
    const http = mockHttp([STATS]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, null, page);

    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]?.url).toBe("https://leetcode.com/graphql");
    expect(http.calls[0]?.method).toBe("POST");
    const body = parseBody(http.calls[0]);
    expect(body.variables).toEqual({ username: HANDLE });
    expect(body.query).not.toContain(HANDLE);

    expect(res.nextPage).toBe(1);
    expect(res.resumeCursor).toBeNull();
    expect(res.snapshot.solves).toEqual([]);
    expect(res.snapshot.extras).toEqual([
      {
        kind: "lc_difficulty_counts",
        payload: {
          solved: { all: 319, easy: 81, medium: 195, hard: 43 },
          total: { all: 4081, easy: 971, medium: 2128, hard: 982 },
        },
      },
    ]);
  });

  it("sends the Referer header", async () => {
    mockHttp([STATS]);
    await leetcodeAdapter.fetchPage(HANDLE, null, null);
    const init = vi.mocked(httpRuntime.fetch).mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>).Referer).toBe("https://leetcode.com");
  });

  it("throws for an unknown user", async () => {
    mockHttp([{ ...STATS, json: UNKNOWN }]);
    const err = leetcodeAdapter.fetchPage("nobody", null, 0);
    await expect(err).rejects.toThrow('No LeetCode user named "nobody".');
    await expect(err).rejects.toBeInstanceOf(PlatformUserNotFoundError);
  });

  it("throws when the response has errors and no data", async () => {
    mockHttp([{ ...STATS, json: { errors: [{ message: "boom" }] } }]);
    await expect(leetcodeAdapter.fetchPage(HANDLE, null, 0)).rejects.toThrow(/boom/);
  });
});

describe("fetchPage tag counts (token 1)", () => {
  it("flattens the three levels and advances to 2", async () => {
    const http = mockHttp([TAGS]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, null, 1);

    expect(parseBody(http.calls[0]).variables).toEqual({ username: HANDLE });
    expect(res.nextPage).toBe(2);
    expect(res.snapshot.solves).toEqual([]);
    const extra = res.snapshot.extras[0];
    expect(extra?.kind).toBe("lc_tag_counts");
    const payload = extra?.payload as {
      tagSlug: string;
      tagName: string;
      level: string;
      problemsSolved: number;
    }[];
    expect(payload).toHaveLength(14 + 16 + 10);
    expect(payload).toContainEqual({
      tagSlug: "dynamic-programming",
      tagName: "Dynamic Programming",
      level: "advanced",
      problemsSolved: 52,
    });
    expect(new Set(payload.map((p) => p.level))).toEqual(
      new Set(["advanced", "intermediate", "fundamental"]),
    );
  });
});

describe("fetchPage recent submissions (token 2)", () => {
  it("dedupes by slug keeping the earliest timestamp", async () => {
    const http = mockHttp([RECENT]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, null, 2);

    expect(parseBody(http.calls[0]).variables).toEqual({ username: HANDLE, limit: 20 });
    const raw = loadFixture<{
      data: { recentAcSubmissionList: { titleSlug: string; timestamp: string }[] };
    }>("leetcode/recent-ac.json").data.recentAcSubmissionList;
    expect(raw).toHaveLength(20);

    expect(res.snapshot.solves).toHaveLength(17);
    expect(new Set(res.snapshot.solves.map((s) => s.externalProblemId)).size).toBe(17);

    const inorder = res.snapshot.solves.find(
      (s) => s.externalProblemId === "binary-tree-inorder-traversal",
    );
    // Re-solved at 1790843572; the first accept was earlier.
    expect(inorder?.firstSolvedAt).toEqual(new Date(1790672143 * 1000));
    expect(inorder).toMatchObject({
      platform: "leetcode",
      problemFallback: {
        title: "Binary Tree Inorder Traversal",
        url: "https://leetcode.com/problems/binary-tree-inorder-traversal/",
        rawTags: [],
      },
    });
    expect(inorder?.problemFallback?.difficultyRaw).toBeUndefined();

    expect(res.nextPage).toBe(3);
    expect(res.resumeCursor).toEqual({ platform: "leetcode", lastAcceptedAt: 1791437578 });
  });

  it("keeps only solves newer than the cursor", async () => {
    mockHttp([RECENT]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, cursor(1790840378), 2);

    const ids = res.snapshot.solves.map((s) => s.externalProblemId).sort();
    expect(ids).toEqual(["kth-smallest-element-in-a-bst", "validate-binary-search-tree"]);
    for (const s of res.snapshot.solves) {
      expect(s.firstSolvedAt!.getTime()).toBeGreaterThan(1790840378 * 1000);
    }
    expect(res.resumeCursor).toEqual({ platform: "leetcode", lastAcceptedAt: 1791437578 });
    expect(res.nextPage).toBe(3);
  });

  it("returns no solves and a null resumeCursor when nothing is new", async () => {
    mockHttp([RECENT]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, cursor(1791437578), 2);
    expect(res.snapshot.solves).toEqual([]);
    expect(res.resumeCursor).toBeNull();
    expect(res.nextPage).toBe(3);
  });
});

describe("fetchPage calendar (token 3 and year tokens)", () => {
  it("converts submissionCalendar keys to UTC days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    const calendar = { 1775692800: 18, 1775692799: 3, 1775779200: 16 };
    mockHttp([
      {
        ...CAL,
        json: {
          data: {
            matchedUser: {
              userCalendar: {
                activeYears: [2026],
                streak: 2,
                totalActiveDays: 3,
                submissionCalendar: JSON.stringify(calendar),
              },
            },
          },
        },
      },
    ]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, null, 3);
    // 1775692800 is 2026-04-09T00:00:00Z; one second earlier is still 2026-04-08 in UTC.
    expect(res.snapshot.activity).toEqual([
      { day: "2026-04-08", count: 3 },
      { day: "2026-04-09", count: 18 },
      { day: "2026-04-10", count: 16 },
    ]);
    expect(res.snapshot.extras).toEqual([
      {
        kind: "lc_calendar",
        payload: { streak: 2, totalActiveDays: 3, activeYears: [2026] },
      },
    ]);
    expect(res.nextPage).toBeNull();
  });

  it("first sync continues to the newest earlier active year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    const http = mockHttp([CAL]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, null, 3);

    const body = parseBody(http.calls[0]);
    expect(body.variables).toEqual({ username: HANDLE });
    expect(body.query).not.toContain("year");
    expect(res.snapshot.activity).toHaveLength(57);
    expect(res.snapshot.activity?.[0]).toEqual({ day: "2026-04-09", count: 18 });
    expect(res.snapshot.extras).toEqual([
      {
        kind: "lc_calendar",
        payload: { streak: 16, totalActiveDays: 57, activeYears: [2023, 2024, 2025, 2026] },
      },
    ]);
    expect(res.nextPage).toBe(2025);
    expect(res.resumeCursor).toBeNull();
  });

  it("first sync early in January skips the current year via the UTC year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:30:00Z"));
    mockHttp([CAL]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, null, 3);
    expect(res.nextPage).toBe(2026);
  });

  it("incremental sync stops after the rolling-year page", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    mockHttp([CAL]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, cursor(1790000000), 3);
    expect(res.nextPage).toBeNull();
    expect(res.snapshot.activity).toHaveLength(57);
  });

  it("year pages chain down through the active years", async () => {
    const http = mockHttp([CAL_YEAR]);
    const seen: (number | null)[] = [];
    let page: number | null = 2025;
    while (page !== null) {
      const res = await leetcodeAdapter.fetchPage(HANDLE, null, page);
      expect(res.snapshot.extras).toEqual([]);
      expect(res.snapshot.solves).toEqual([]);
      seen.push(res.nextPage);
      page = res.nextPage;
    }
    expect(seen).toEqual([2024, 2023, null]);
    expect(http.calls.map((c) => parseBody(c).variables)).toEqual([
      { username: HANDLE, year: 2025 },
      { username: HANDLE, year: 2024 },
      { username: HANDLE, year: 2023 },
    ]);
  });

  it("converts a year page's calendar", async () => {
    mockHttp([CAL_YEAR]);
    const res = await leetcodeAdapter.fetchPage(HANDLE, null, 2023);
    expect(res.snapshot.activity).toHaveLength(14);
    expect(res.snapshot.activity?.[0]).toEqual({ day: "2023-01-22", count: 16 });
    expect(res.nextPage).toBeNull();
  });

  it("throws for an unknown user", async () => {
    mockHttp([{ ...CAL, json: UNKNOWN }]);
    await expect(leetcodeAdapter.fetchPage("nobody", null, 3)).rejects.toThrow(
      'No LeetCode user named "nobody".',
    );
  });
});

describe("fetchPage misc", () => {
  it("rejects an unknown page token", async () => {
    mockHttp([]);
    await expect(leetcodeAdapter.fetchPage(HANDLE, null, 7)).rejects.toThrow(/page token/);
  });

  it("throws for an unknown user on the recent and tag pages", async () => {
    mockHttp([
      { ...RECENT, json: { errors: [{ message: "That user does not exist." }], data: null } },
      { ...TAGS, json: UNKNOWN },
    ]);
    await expect(leetcodeAdapter.fetchPage("nobody", null, 2)).rejects.toThrow(
      /That user does not exist/,
    );
    await expect(leetcodeAdapter.fetchPage("nobody", null, 1)).rejects.toThrow(
      'No LeetCode user named "nobody".',
    );
  });
});

describe("validateHandle", () => {
  const VALIDATE = (json: unknown, rest: Omit<MockRoute, "match" | "json"> = {}): MockRoute => ({
    ...gqlRoute("username }", {}),
    json,
    ...rest,
  });

  it("returns valid with the canonical handle", async () => {
    const http = mockHttp([VALIDATE({ data: { matchedUser: { username: "CptDailyBird" } } })]);
    await expect(leetcodeAdapter.validateHandle("cptdailybird")).resolves.toEqual({
      result: "valid",
      canonicalHandle: "CptDailyBird",
    });
    expect(parseBody(http.calls[0]).variables).toEqual({ username: "cptdailybird" });
  });

  it("returns invalid for HTTP 200 + errors + null user", async () => {
    mockHttp([VALIDATE(UNKNOWN)]);
    await expect(leetcodeAdapter.validateHandle("nobody")).resolves.toEqual({
      result: "invalid",
      message: 'No LeetCode user named "nobody".',
    });
  });

  it("returns retry on 503 after retries are exhausted", async () => {
    const http = mockHttp([VALIDATE({}, { status: 503 })]);
    const res = await leetcodeAdapter.validateHandle(HANDLE);
    expect(res.result).toBe("retry");
    expect(http.calls.length).toBeGreaterThan(1);
  });

  it("returns retry on 429", async () => {
    mockHttp([VALIDATE({}, { status: 429 })]);
    expect((await leetcodeAdapter.validateHandle(HANDLE)).result).toBe("retry");
  });

  it("returns retry on a network error", async () => {
    mockHttp([VALIDATE(null, { error: new Error("ECONNRESET") })]);
    const res = await leetcodeAdapter.validateHandle(HANDLE);
    expect(res.result).toBe("retry");
  });

  it("returns retry when the reply has no data and no null user", async () => {
    mockHttp([VALIDATE({ errors: [{ message: "internal" }] })]);
    const res = await leetcodeAdapter.validateHandle(HANDLE);
    expect(res).toMatchObject({ result: "retry" });
  });

  it("returns retry on a non-JSON reply instead of throwing", async () => {
    mockHttp([{ ...gqlRoute("username }", {}), text: "<html>blocked</html>" }]);
    const res = await leetcodeAdapter.validateHandle(HANDLE);
    expect(res.result).toBe("retry");
  });

  it("HttpError is what the retry path inspects", () => {
    expect(new HttpError("status", "u", "m", 503).retryable).toBe(true);
  });
});

describe("readVerificationField", () => {
  const PROFILE = gqlRoute("aboutMe", {});

  it("returns null for an empty aboutMe", async () => {
    const http = mockHttp([{ ...PROFILE, json: loadFixture("leetcode/profile.json") }]);
    await expect(leetcodeAdapter.readVerificationField(HANDLE)).resolves.toBeNull();
    expect(parseBody(http.calls[0]).variables).toEqual({ username: HANDLE });
  });

  it("returns the trimmed aboutMe", async () => {
    mockHttp([
      {
        ...PROFILE,
        json: {
          data: { matchedUser: { username: HANDLE, profile: { aboutMe: "  codelogs-abc123 \n" } } },
        },
      },
    ]);
    await expect(leetcodeAdapter.readVerificationField(HANDLE)).resolves.toBe("codelogs-abc123");
  });

  it("returns null for whitespace-only aboutMe", async () => {
    mockHttp([
      {
        ...PROFILE,
        json: { data: { matchedUser: { username: HANDLE, profile: { aboutMe: "  " } } } },
      },
    ]);
    await expect(leetcodeAdapter.readVerificationField(HANDLE)).resolves.toBeNull();
  });

  it("returns null for an unknown user", async () => {
    mockHttp([{ ...PROFILE, json: UNKNOWN }]);
    await expect(leetcodeAdapter.readVerificationField("nobody")).resolves.toBeNull();
  });
});

describe("leetcodeCatalog.fetchCatalog", () => {
  const q = (slug: string, difficulty: string, paidOnly = false, tags: string[] = []) => ({
    title: `Title ${slug}`,
    titleSlug: slug,
    difficulty,
    paidOnly,
    topicTags: tags.map((t) => ({ name: t, slug: t })),
  });
  const catalogRoute = (skip: number, total: number, questions: unknown[]): MockRoute => ({
    match: (_url, body) => !!body && (JSON.parse(body) as GqlBody).variables.skip === skip,
    json: { data: { problemsetQuestionList: { total, questions } } },
  });

  it("paginates with skip and stops once total is reached", async () => {
    const http = mockHttp([
      catalogRoute(0, 3, [q("two-sum", "Easy", false, ["array", "hash-table"]), q("a", "Medium")]),
      catalogRoute(2, 3, [q("locked", "Hard", true)]),
    ]);
    const out = await leetcodeCatalog.fetchCatalog();

    expect(http.calls).toHaveLength(2);
    expect(http.calls.map((c) => parseBody(c).variables)).toEqual([
      { limit: 100, skip: 0 },
      { limit: 100, skip: 2 },
    ]);
    expect(out).toEqual([
      {
        platform: "leetcode",
        externalId: "two-sum",
        title: "Title two-sum",
        url: "https://leetcode.com/problems/two-sum/",
        difficultyRaw: "Easy",
        rawTags: ["array", "hash-table"],
        paidOnly: false,
      },
      {
        platform: "leetcode",
        externalId: "a",
        title: "Title a",
        url: "https://leetcode.com/problems/a/",
        difficultyRaw: "Medium",
        rawTags: [],
        paidOnly: false,
      },
      {
        platform: "leetcode",
        externalId: "locked",
        title: "Title locked",
        url: "https://leetcode.com/problems/locked/",
        difficultyRaw: "Hard",
        rawTags: [],
        paidOnly: true,
      },
    ]);
  });

  it("stops on an empty page even if total says there is more", async () => {
    const http = mockHttp([catalogRoute(0, 50, [q("a", "EASY")]), catalogRoute(1, 50, [])]);
    const out = await leetcodeCatalog.fetchCatalog();
    expect(http.calls).toHaveLength(2);
    expect(out.map((p) => p.difficultyRaw)).toEqual(["Easy"]);
  });

  it("caps the number of pages", async () => {
    const http = mockHttp([
      {
        match: "graphql",
        json: {
          data: { problemsetQuestionList: { total: 1_000_000, questions: [q("x", "Easy")] } },
        },
      },
    ]);
    const out = await leetcodeCatalog.fetchCatalog();
    expect(http.calls).toHaveLength(100);
    expect(out).toHaveLength(1);
  });

  it("parses the saved catalog page fixture", async () => {
    const fixture = loadFixture<{
      data: { problemsetQuestionList: { total: number; questions: unknown[] } };
    }>("leetcode/catalog-page.json");
    const list = fixture.data.problemsetQuestionList;
    mockHttp([
      {
        match: "graphql",
        json: { data: { problemsetQuestionList: { ...list, total: list.questions.length } } },
      },
    ]);
    const out = await leetcodeCatalog.fetchCatalog();
    expect(out).toHaveLength(30);
    expect(out[0]).toMatchObject({
      externalId: "two-sum",
      difficultyRaw: "Easy",
      rawTags: ["array", "hash-table"],
    });
  });

  it("throws when the catalog errors", async () => {
    mockHttp([{ match: "graphql", json: { errors: [{ message: "nope" }] } }]);
    await expect(leetcodeCatalog.fetchCatalog()).rejects.toThrow(/nope/);
  });
});
