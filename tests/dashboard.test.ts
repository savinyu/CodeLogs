import { describe, expect, it } from "vitest";
import {
  addDays,
  buildDashboard,
  filterDashboard,
  GAP_TAGS_PER_PLATFORM,
  humanizeSlug,
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
    solvedTags: [
      { platform: "codeforces", tag: "greedy", count: 21 },
      { platform: "leetcode", tag: "array", count: 9 },
    ],
    catalogTags: [
      { platform: "codeforces", tag: "greedy", count: 3590 },
      { platform: "codeforces", tag: "dp", count: 2544 },
      { platform: "leetcode", tag: "array", count: 2273 },
      { platform: "leetcode", tag: "hash-table", count: 843 },
    ],
    recent: [],
    cfSolves: [],
    cfCatalog: [],
    lcCatalog: [],
    ...overrides,
  };
}

describe("helpers", () => {
  it("adds days across month and year boundaries in UTC", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays(ASOF, -364)).toBe("2025-10-14");
  });

  it("humanizes LeetCode slugs", () => {
    expect(humanizeSlug("hash-table")).toBe("Hash Table");
    expect(humanizeSlug("dp")).toBe("Dp");
  });

  it("parses the platform filter, defaulting to all", () => {
    expect(parsePlatformFilter("codeforces")).toBe("codeforces");
    expect(parsePlatformFilter("hackerrank")).toBe("all");
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
      { platform: "leetcode", solved: 319, source: "reported", listed: 17 },
    ]);
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

  it("lists solved tags first, then popular unsolved catalog tags as gaps", () => {
    const d = buildDashboard(raw(), ASOF);
    expect(d.tags.map((t) => [t.platform, t.source])).toEqual([
      ["codeforces", "tracked"],
      ["leetcode", "reported"],
    ]);
    expect(d.tags[0]!.tags).toEqual([
      { tag: "greedy", label: "greedy", solved: 21, catalogCount: 3590 },
      { tag: "dp", label: "dp", solved: 0, catalogCount: 2544 },
    ]);
    // LC: reported counts win over solve rows; zero-count reported tags aren't "solved".
    expect(d.tags[1]!.tags).toEqual([
      { tag: "array", label: "Array", solved: 183, catalogCount: 2273 },
      { tag: "hash-table", label: "Hash Table", solved: 0, catalogCount: 843 },
    ]);
  });

  it("caps gap tags per platform", () => {
    const catalogTags = Array.from({ length: GAP_TAGS_PER_PLATFORM + 10 }, (_, i) => ({
      platform: "codeforces" as const,
      tag: `tag${i}`,
      count: 1000 - i,
    }));
    const d = buildDashboard(raw({ catalogTags, solvedTags: [] }), ASOF);
    expect(d.tags.find((t) => t.platform === "codeforces")!.tags).toHaveLength(
      GAP_TAGS_PER_PLATFORM,
    );
  });

  it("leaves out tag sections for platforms that aren't connected", () => {
    const d = buildDashboard(raw({ accounts: [account("atcoder")] }), ASOF);
    expect(d.tags).toEqual([]);
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
    expect(lc.tags.map((t) => t.platform)).toEqual(["leetcode"]);
  });
});
