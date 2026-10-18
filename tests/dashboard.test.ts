import { describe, expect, it } from "vitest";
import {
  addDays,
  buildDashboard,
  contestUrl,
  filterDashboard,
  parsePlatformFilter,
  RECENT_LIMIT,
  type DashboardRaw,
} from "@/lib/dashboard/aggregate";
import type { AccountSummary, RecentSolve } from "@/lib/dashboard/types";

const ASOF = "2026-10-13";

function account(platform: AccountSummary["platform"], handle = "me"): AccountSummary {
  return {
    platform,
    handle,
    status: "ok",
    verified: false,
    historyComplete: false,
    lastSyncedAt: null,
  };
}

function raw(overrides: Partial<DashboardRaw> = {}): DashboardRaw {
  return {
    accounts: [account("leetcode"), account("codeforces"), account("atcoder")],
    solveCounts: [
      { platform: "codeforces", count: 46 },
      { platform: "leetcode", count: 17 },
    ],
    stats: [
      {
        platform: "codeforces",
        kind: "cf_rating",
        payload: { rating: 839, maxRating: 1062, rank: "newbie", maxRank: "newbie" },
      },
      {
        platform: "leetcode",
        kind: "lc_difficulty_counts",
        payload: {
          solved: { all: 319, easy: 81, medium: 195, hard: 43 },
          total: { all: 4081, easy: 971, medium: 2128, hard: 982 },
        },
      },
      {
        platform: "leetcode",
        kind: "lc_tag_counts",
        payload: [
          { tagSlug: "array", tagName: "Array", level: "fundamental", problemsSolved: 183 },
          { tagSlug: "trie", tagName: "Trie", level: "advanced", problemsSolved: 0 },
        ],
      },
    ],
    solveDays: [],
    calendarDays: [],
    difficulty: [
      { platform: "codeforces", band: 1, count: 40 },
      { platform: "codeforces", band: null, count: 6 },
      { platform: "leetcode", band: 3, count: 10 },
    ],
    recent: [],
    cfSolves: [],
    cfCatalog: [],
    lcCatalog: [],
    contests: [],
    ...overrides,
  };
}

describe("helpers", () => {
  it("adds days across month and year boundaries in UTC", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays(ASOF, -364)).toBe("2025-10-14");
  });

  it("parses the platform filter, defaulting to all", () => {
    expect(parsePlatformFilter("codeforces")).toBe("codeforces");
    expect(parsePlatformFilter("hackerrank")).toBe("hackerrank");
    expect(parsePlatformFilter("topcoder")).toBe("all");
    expect(parsePlatformFilter(undefined)).toBe("all");
    expect(parsePlatformFilter(["codeforces"])).toBe("all");
  });
});

describe("buildDashboard", () => {
  it("orders accounts and totals by platform, using LeetCode's reported count", () => {
    const d = buildDashboard(raw(), ASOF);
    expect(d.accounts.map((a) => a.platform)).toEqual(["codeforces", "atcoder", "leetcode"]);
    expect(d.totals).toEqual([
      {
        platform: "codeforces",
        solved: 46,
        source: "tracked",
        listed: 46,
        rating: { current: 839, max: 1062, rank: "newbie" },
      },
      { platform: "atcoder", solved: 0, source: "tracked", listed: 0 },
      {
        platform: "leetcode",
        solved: 319,
        source: "reported",
        listed: 17,
        split: { easy: 81, medium: 195, hard: 43 },
      },
    ]);
  });

  it("leaves the LeetCode split out when the payload lacks a level", () => {
    const d = buildDashboard(
      raw({
        stats: [
          { platform: "leetcode", kind: "lc_difficulty_counts", payload: { solved: { all: 50 } } },
        ],
      }),
      ASOF,
    );
    const lc = d.totals.find((t) => t.platform === "leetcode");
    expect(lc).toEqual({ platform: "leetcode", solved: 50, source: "reported", listed: 17 });
  });

  it("falls back to tracked LeetCode rows when the stats payload is missing or malformed", () => {
    const d = buildDashboard(
      raw({ stats: [{ platform: "leetcode", kind: "lc_difficulty_counts", payload: "oops" }] }),
      ASOF,
    );
    expect(d.totals.find((t) => t.platform === "leetcode")).toEqual({
      platform: "leetcode",
      solved: 17,
      source: "tracked",
      listed: 17,
    });
    expect(d.totals.find((t) => t.platform === "codeforces")?.rating).toBeUndefined();
  });

  it("uses a platform's calendar over its solve days, and keeps every year up to asOf", () => {
    const d = buildDashboard(
      raw({
        solveDays: [
          { platform: "codeforces", day: "2026-10-01", count: 2 },
          { platform: "leetcode", day: "2026-10-01", count: 1 }, // ignored: LC has a calendar
          { platform: "codeforces", day: "2023-02-13", count: 5 }, // earlier years stay
        ],
        calendarDays: [
          { platform: "leetcode", day: "2026-10-01", count: 4 },
          { platform: "leetcode", day: "2025-10-14", count: 1 },
          { platform: "leetcode", day: "2026-10-14", count: 9 }, // after asOf
        ],
      }),
      ASOF,
    );
    expect(d.activity).toEqual([
      { day: "2023-02-13", counts: { codeforces: 5 }, total: 5 },
      { day: "2025-10-14", counts: { leetcode: 1 }, total: 1 },
      { day: "2026-10-01", counts: { codeforces: 2, leetcode: 4 }, total: 6 },
    ]);
  });

  it("splits difficulty into six fixed rows, with LeetCode's lifetime split", () => {
    const d = buildDashboard(raw(), ASOF);
    expect(d.difficulty.map((r) => r.band)).toEqual([1, 2, 3, 4, 5, null]);
    expect(d.difficulty.map((r) => r.counts)).toEqual([
      { codeforces: 40, leetcode: 81 },
      {},
      { leetcode: 195 },
      { leetcode: 43 },
      {},
      { codeforces: 6 },
    ]);
    expect(d.difficulty.map((r) => r.total)).toEqual([121, 0, 195, 43, 0, 6]);
  });

  describe("extension platforms", () => {
    const ibCounts = {
      platform: "interviewbit" as const,
      kind: "ext_counts",
      payload: {
        total: 40,
        byDifficulty: { very_easy: 5, easy: 15, medium: 15, hard: 5 },
        split: { easy: 20, medium: 15, hard: 5 },
      },
    };

    it("uses the reported ext_counts total and split, in platform order", () => {
      const d = buildDashboard(
        raw({
          accounts: [account("interviewbit"), account("leetcode"), account("gfg")],
          stats: [ibCounts],
        }),
        ASOF,
      );
      expect(d.totals.map((t) => t.platform)).toEqual(["leetcode", "interviewbit", "gfg"]);
      expect(d.totals.find((t) => t.platform === "interviewbit")).toEqual({
        platform: "interviewbit",
        solved: 40,
        source: "reported",
        listed: 0,
        split: { easy: 20, medium: 15, hard: 5 },
      });
      // No upload yet: tracked rows, no split.
      expect(d.totals.find((t) => t.platform === "gfg")).toEqual({
        platform: "gfg",
        solved: 0,
        source: "tracked",
        listed: 0,
      });
    });

    it("keeps the total but omits the split when no label maps to a tier", () => {
      const d = buildDashboard(
        raw({
          accounts: [account("codechef")],
          solveCounts: [],
          stats: [
            {
              platform: "codechef",
              kind: "ext_counts",
              payload: { total: 12, byDifficulty: {}, split: null },
            },
          ],
        }),
        ASOF,
      );
      expect(d.totals).toEqual([
        { platform: "codechef", solved: 12, source: "reported", listed: 0 },
      ]);
    });

    it("ignores a malformed ext_counts payload", () => {
      const d = buildDashboard(
        raw({
          accounts: [account("hackerrank")],
          solveCounts: [{ platform: "hackerrank", count: 3 }],
          stats: [{ platform: "hackerrank", kind: "ext_counts", payload: { total: "many" } }],
        }),
        ASOF,
      );
      expect(d.totals).toEqual([
        { platform: "hackerrank", solved: 3, source: "tracked", listed: 3 },
      ]);
    });

    it("adds the reported split to the difficulty chart: easy 1, medium 3, hard 4", () => {
      const d = buildDashboard(
        raw({ accounts: [account("interviewbit")], difficulty: [], stats: [ibCounts] }),
        ASOF,
      );
      expect(d.difficulty.map((r) => r.counts)).toEqual([
        { interviewbit: 20 },
        {},
        { interviewbit: 15 },
        { interviewbit: 5 },
        {},
        {},
      ]);
    });

    it("prefers the solve rows when they cover the reported total (no double counting)", () => {
      const gfg = {
        platform: "gfg" as const,
        kind: "ext_counts",
        payload: { total: 10, byDifficulty: {}, split: { easy: 6, medium: 3, hard: 1 } },
      };
      const rows = (count: number) => ({
        accounts: [account("gfg")],
        solveCounts: [{ platform: "gfg" as const, count }],
        difficulty: [
          { platform: "gfg" as const, band: 1, count: Math.floor(count / 2) },
          { platform: "gfg" as const, band: 3, count: count - Math.floor(count / 2) },
        ],
        stats: [gfg],
      });
      const covered = buildDashboard(raw(rows(10)), ASOF);
      expect(covered.difficulty.map((r) => r.total)).toEqual([5, 0, 5, 0, 0, 0]);
      const partial = buildDashboard(raw(rows(4)), ASOF);
      expect(partial.difficulty.map((r) => r.total)).toEqual([6, 0, 3, 1, 0, 0]);
    });

    it("filters to one extension platform", () => {
      const d = filterDashboard(
        buildDashboard(
          raw({ accounts: [account("interviewbit"), account("leetcode")], stats: [ibCounts] }),
          ASOF,
        ),
        parsePlatformFilter("interviewbit"),
      );
      expect(d.totals.map((t) => t.platform)).toEqual(["interviewbit"]);
      expect(d.contests).toEqual([]);
    });
  });

  it("lists only connected platforms in the totals", () => {
    const d = buildDashboard(raw({ accounts: [account("atcoder")] }), ASOF);
    expect(d.totals).toEqual([{ platform: "atcoder", solved: 0, source: "tracked", listed: 0 }]);
  });
});

describe("filterDashboard", () => {
  it("scores topics from CF solves and LC tag counts, and narrows them by platform", () => {
    const all = buildDashboard(
      raw({
        cfSolves: [{ tags: ["dp"], rating: "900" }],
        cfCatalog: [{ tags: ["dp"], count: 4 }],
        lcCatalog: [{ tags: ["trie"], count: 4 }],
      }),
      ASOF,
    );
    expect(all.cfLevel).toBe(839);
    const dp = all.topics.find((t) => t.slug === "dp")!;
    expect(dp.platforms.map((p) => [p.platform, p.solved])).toEqual([
      ["codeforces", 1],
      ["leetcode", 0],
    ]);
    const cf = filterDashboard(all, "codeforces").topics.find((t) => t.slug === "dp")!;
    expect(cf.platforms.map((p) => p.platform)).toEqual(["codeforces"]);
    expect(cf.micros.every((u) => u.platforms.every((p) => p.platform === "codeforces"))).toBe(
      true,
    );
    expect(filterDashboard(all, "atcoder").topics.every((t) => t.platforms.length === 0)).toBe(
      true,
    );
  });

  const data = buildDashboard(
    raw({
      calendarDays: [{ platform: "leetcode", day: "2026-10-01", count: 4 }],
      solveDays: [
        { platform: "codeforces", day: "2026-10-01", count: 2 },
        { platform: "codeforces", day: "2026-10-02", count: 1 },
      ],
    }),
    ASOF,
  );

  it("returns everything for all", () => {
    expect(filterDashboard(data, "all")).toEqual(data);
  });

  it("sorts recent solves newest first and trims them after filtering", () => {
    const solve = (platform: RecentSolve["platform"], i: number): RecentSolve => ({
      platform,
      externalId: `${platform}-${i}`,
      title: "t",
      url: "u",
      // LeetCode solves are all newer than Codeforces ones.
      solvedAt: new Date(Date.UTC(2026, platform === "leetcode" ? 9 : 0, i + 1)).toISOString(),
      difficultyRaw: null,
      difficultyNorm: null,
      tags: [],
    });
    const recent = [
      ...Array.from({ length: RECENT_LIMIT }, (_, i) => solve("codeforces", i)),
      ...Array.from({ length: RECENT_LIMIT }, (_, i) => solve("leetcode", i)),
      { ...solve("atcoder", 0), solvedAt: null },
    ];
    const d = buildDashboard(raw({ recent }), ASOF);

    const all = filterDashboard(d, "all").recent;
    expect(all).toHaveLength(RECENT_LIMIT);
    expect(all.every((s) => s.platform === "leetcode")).toBe(true);
    expect(all[0]!.externalId).toBe(`leetcode-${RECENT_LIMIT - 1}`);

    const cf = filterDashboard(d, "codeforces").recent;
    expect(cf).toHaveLength(RECENT_LIMIT);
    expect(cf.every((s) => s.platform === "codeforces")).toBe(true);
    expect(d.recent.at(-1)!.platform).toBe("atcoder"); // undated last
  });

  it("narrows every section to one platform", () => {
    const lc = filterDashboard(data, "leetcode");
    expect(lc.accounts.map((a) => a.platform)).toEqual(["leetcode"]);
    expect(lc.totals.map((t) => t.platform)).toEqual(["leetcode"]);
    expect(lc.activity).toEqual([{ day: "2026-10-01", counts: { leetcode: 4 }, total: 4 }]);
    expect(lc.difficulty.map((r) => r.total)).toEqual([81, 0, 195, 43, 0, 0]);
  });
});

describe("contests and LeetCode badges", () => {
  const contest = (
    platform: "codeforces" | "leetcode",
    contestKey: string,
    heldAt: string,
    rank: number | null,
    oldRating: number | null,
    newRating: number | null,
  ) => ({
    platform,
    contestKey,
    name: `Contest ${contestKey}`,
    heldAt,
    rank,
    oldRating,
    newRating,
  });

  const withContests = (extraStats: DashboardRaw["stats"] = []) =>
    raw({
      contests: [
        contest("codeforces", "1842", "2023-06-24T17:05:00.000Z", 10469, 946, 839),
        contest("codeforces", "1782", "2023-01-15T15:05:00.000Z", 8122, 0, 369),
        contest("codeforces", "1792", "2023-01-24T16:35:00.000Z", 13922, 369, 1062),
        contest("leetcode", "weekly-contest-416", "2024-09-22T02:30:00.000Z", 2663, null, 1601),
      ],
      stats: [...raw().stats, ...extraStats],
    });

  it("builds one entry per connected CF / LC account, oldest first, with stats", () => {
    const data = buildDashboard(withContests(), ASOF);
    expect(data.contests.map((c) => c.platform)).toEqual(["codeforces", "leetcode"]);
    const cf = data.contests[0]!;
    expect(cf.contests.map((c) => c.contestKey)).toEqual(["1782", "1792", "1842"]);
    expect(cf.contests[0]!.url).toBe("https://codeforces.com/contest/1782");
    expect(cf).toMatchObject({ attended: 3, bestRank: 8122, currentRating: 839, maxRating: 1062 });
    expect(cf.badge).toBeUndefined();
  });

  it("uses LeetCode's own summary for rating, count and badge when it has one", () => {
    const data = buildDashboard(
      withContests([
        {
          platform: "leetcode",
          kind: "lc_contest",
          payload: {
            attended: 27,
            rating: 2204.316,
            globalRanking: 7558,
            totalParticipants: 887132,
            topPercentage: 0.9,
            badge: "Guardian",
          },
        },
      ]),
      ASOF,
    );
    expect(data.contests[1]).toMatchObject({
      platform: "leetcode",
      attended: 27,
      currentRating: 2204,
      maxRating: 1601,
      bestRank: 2663,
      globalRanking: 7558,
      topPercentage: 0.9,
      badge: "Guardian",
    });
    expect(data.contests[1]!.contests[0]!.url).toBe(
      "https://leetcode.com/contest/weekly-contest-416/",
    );
  });

  it("shows an empty entry for a connected platform with no contests, and none for AtCoder", () => {
    const data = buildDashboard(raw(), ASOF);
    expect(data.contests).toEqual([
      {
        platform: "codeforces",
        contests: [],
        attended: 0,
        bestRank: null,
        currentRating: null,
        maxRating: null,
      },
      {
        platform: "leetcode",
        contests: [],
        attended: 0,
        bestRank: null,
        currentRating: null,
        maxRating: null,
        globalRanking: null,
        topPercentage: null,
        badge: null,
      },
    ]);
    const atcoderOnly = buildDashboard(raw({ accounts: [account("atcoder")] }), ASOF);
    expect(atcoderOnly.contests).toEqual([]);
  });

  it("sorts badges newest first, drops malformed payloads, and narrows by platform", () => {
    const badge = (id: string, earnedAt: string | null) => ({
      id,
      name: `Badge ${id}`,
      icon: `https://assets.leetcode.com/${id}.png`,
      earnedAt,
      category: "ANNUAL",
    });
    const data = buildDashboard(
      withContests([
        {
          platform: "leetcode",
          kind: "lc_badges",
          payload: [badge("a", "2024-12-01"), badge("b", null), badge("c", "2026-09-09")],
        },
      ]),
      ASOF,
    );
    expect(data.leetcodeBadges.map((b) => b.id)).toEqual(["c", "a", "b"]);
    expect(filterDashboard(data, "leetcode").leetcodeBadges).toHaveLength(3);
    expect(filterDashboard(data, "codeforces").leetcodeBadges).toEqual([]);
    expect(filterDashboard(data, "codeforces").contests.map((c) => c.platform)).toEqual([
      "codeforces",
    ]);

    const bad = buildDashboard(
      raw({
        stats: [
          ...raw().stats,
          {
            platform: "leetcode",
            kind: "lc_badges",
            payload: [{ ...badge("x", null), icon: "javascript:alert(1)" }],
          },
        ],
      }),
      ASOF,
    );
    expect(bad.leetcodeBadges).toEqual([]);
    const noLc = buildDashboard(raw({ accounts: [account("codeforces")] }), ASOF);
    expect(noLc.leetcodeBadges).toEqual([]);
  });

  it("builds contest URLs", () => {
    expect(contestUrl("codeforces", "1842")).toBe("https://codeforces.com/contest/1842");
    expect(contestUrl("leetcode", "biweekly-contest-1")).toBe(
      "https://leetcode.com/contest/biweekly-contest-1/",
    );
  });
});
