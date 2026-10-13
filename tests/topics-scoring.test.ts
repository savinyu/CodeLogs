import { describe, expect, it } from "vitest";
import type { MacroTopicStat } from "@/lib/dashboard/types";
import {
  buildTopicStats,
  cfCatalogCap,
  cfLevel,
  MIN_EXPECTED,
  ratingWeight,
  scoreTopic,
  weakTopics,
  type ScoringInput,
} from "@/lib/topics/scoring";
import { MACRO_SLUGS } from "@/lib/topics/taxonomy";

function input(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    cfSolves: [],
    cfLevel: null,
    cfCatalog: [],
    lcTagCounts: null,
    lcSolved: 0,
    lcCatalog: [],
    ...overrides,
  };
}

const find = (topics: MacroTopicStat[], slug: string) => topics.find((t) => t.slug === slug)!;
const micro = (topics: MacroTopicStat[], macro: string, slug: string) =>
  find(topics, macro).micros.find((u) => u.slug === slug)!;

describe("levels and weights", () => {
  it("uses the rating, else the median rated solve, else 1200", () => {
    expect(cfLevel(839, [800, 1500])).toBe(839);
    expect(cfLevel(null, [800, 1000, 1500])).toBe(1000);
    expect(cfLevel(null, [800, 1000])).toBe(800);
    expect(cfLevel(0, [])).toBe(1200);
  });

  it("caps the catalog at level + 300, in CF's steps of 100", () => {
    expect(cfCatalogCap(839)).toBe(1100);
    expect(cfCatalogCap(1200)).toBe(1500);
  });

  it("weights solves by rating against the level, within 0.25–1.25", () => {
    expect(ratingWeight(1000, 1000)).toBe(1);
    expect(ratingWeight(600, 1000)).toBe(0.5);
    expect(ratingWeight(800, 2000)).toBe(0.25);
    expect(ratingWeight(3000, 1000)).toBe(1.25);
    expect(ratingWeight(null, 1000)).toBe(0.75);
  });
});

describe("buildTopicStats", () => {
  it("puts a CF dp solve and LeetCode's DP count under one Dynamic Programming topic", () => {
    const topics = buildTopicStats(
      input({
        cfLevel: 1000,
        cfSolves: [{ tags: ["dp", "greedy"], rating: 1000 }],
        cfCatalog: [{ tags: ["dp"], count: 10 }],
        lcTagCounts: [{ tag: "dynamic-programming", solved: 7 }],
        lcSolved: 20,
        lcCatalog: [{ tags: ["dynamic-programming"], count: 5 }],
      }),
    );
    expect(topics.map((t) => t.slug)).toEqual(MACRO_SLUGS);
    const dp = find(topics, "dp");
    expect(dp.name).toBe("Dynamic Programming");
    expect(dp.platforms.map((p) => [p.platform, p.solved])).toEqual([
      ["codeforces", 1],
      ["leetcode", 7],
    ]);
    expect(scoreTopic(dp).solved).toBe(8);
  });

  it("has no platforms when neither CF nor LC has topic data", () => {
    const topics = buildTopicStats(input());
    expect(topics.every((t) => t.platforms.length === 0)).toBe(true);
    expect(weakTopics(topics)).toEqual([]);
  });

  it("expects CF solves at the catalog's share, weighted by rating", () => {
    const topics = buildTopicStats(
      input({
        cfLevel: 1000,
        cfSolves: [
          { tags: ["graphs", "dfs and similar"], rating: 1000 }, // counts once for Graphs
          { tags: ["math"], rating: 600 }, // weight 0.5
          { tags: ["math"], rating: 1000 },
          { tags: ["implementation"], rating: 1000 },
        ],
        cfCatalog: [
          { tags: ["graphs", "dfs and similar"], count: 25 },
          { tags: ["math"], count: 50 },
          { tags: ["implementation"], count: 25 },
        ],
      }),
    );
    const total = 1 + 0.5 + 1 + 1;
    const graphs = find(topics, "graphs").platforms[0]!;
    expect(graphs).toEqual({ platform: "codeforces", solved: 1, weighted: 1, expected: total / 4 });
    const math = find(topics, "math").platforms[0]!;
    expect(math).toMatchObject({ solved: 2, weighted: 1.5, expected: total / 2 });
    expect(micro(topics, "graphs", "graph-traversal").platforms[0]).toMatchObject({ solved: 1 });
    expect(micro(topics, "graphs", "shortest-paths").platforms[0]).toMatchObject({
      solved: 0,
      expected: 0,
    });
  });

  it("scales LeetCode's summed tag counts by how much the tags overlap in the catalog", () => {
    const topics = buildTopicStats(
      input({
        // Every graph problem in the catalog is also tagged BFS, so 10 + 10 is ~10 problems.
        lcTagCounts: [
          { tag: "graph", solved: 10 },
          { tag: "breadth-first-search", solved: 10 },
        ],
        lcSolved: 40,
        lcCatalog: [
          { tags: ["graph", "breadth-first-search"], count: 20 },
          { tags: ["array"], count: 80 },
        ],
      }),
    );
    expect(find(topics, "graphs").platforms[0]).toEqual({
      platform: "leetcode",
      solved: 10,
      weighted: 10,
      expected: 40 * 0.2,
    });
  });

  it("ignores catalog tags LeetCode never counts per user", () => {
    const topics = buildTopicStats(
      input({
        lcTagCounts: [{ tag: "math", solved: 5 }],
        lcSolved: 10,
        lcCatalog: [
          { tags: ["prefix-sum"], count: 50 },
          { tags: ["math", "number-theory"], count: 50 },
        ],
      }),
    );
    expect(micro(topics, "data-structures", "prefix-sums").platforms[0]!.expected).toBe(0);
    expect(micro(topics, "math", "number-theory").platforms[0]!.expected).toBe(0);
    expect(find(topics, "math").platforms[0]).toMatchObject({ solved: 5, expected: 5 });
  });
});

describe("weakTopics", () => {
  function topics(
    rows: Record<string, [weighted: number, expected: number]>,
    micros: Record<string, [weighted: number, expected: number]> = {},
  ) {
    const stat = (w: number, e: number) => [
      { platform: "codeforces" as const, solved: Math.round(w), weighted: w, expected: e },
    ];
    return buildTopicStats(input()).map((t) => {
      const [w, e] = rows[t.slug] ?? [10, 10];
      return {
        ...t,
        platforms: stat(w, e),
        micros: t.micros.map((u) => {
          const [mw, me] = micros[u.slug] ?? [0, 0];
          return { ...u, platforms: stat(mw, me) };
        }),
      };
    });
  }

  it("returns up to 3 topics below 80% coverage, weakest first", () => {
    const weak = weakTopics(
      topics({ dp: [0, 10], graphs: [2, 10], math: [5, 10], strings: [6, 10], trees: [8, 10] }),
    );
    expect(weak.map((w) => w.slug)).toEqual(["dp", "graphs", "math"]);
    expect(weak[0]!.coverage).toBeCloseTo(2 / 12);
  });

  it("needs enough expected solves before calling a topic weak", () => {
    expect(weakTopics(topics({ dp: [0, MIN_EXPECTED - 0.1] }))).toEqual([]);
    expect(weakTopics(topics({ dp: [0, MIN_EXPECTED] })).map((w) => w.slug)).toEqual(["dp"]);
  });

  it("focuses on the micro topic furthest behind, not the lowest ratio", () => {
    const [weak] = weakTopics(
      topics(
        { graphs: [2, 20] },
        { "shortest-paths": [0, 1.5], "graph-traversal": [3, 12], mst: [5, 5] },
      ),
    );
    expect(weak!.focus).toEqual({ slug: "graph-traversal", name: "BFS & DFS" });
  });
});
