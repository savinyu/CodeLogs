import { describe, expect, it } from "vitest";
import type { NormalizedSolve } from "@/lib/adapters/types";
import { parseCursor, resolveCursor } from "@/lib/sync/cursor";
import { normalizeDifficulty } from "@/lib/sync/difficulty";
import { catalogRows, chunk, dedupeSolves, stubRows, toProblemRow } from "@/lib/sync/rows";

describe("normalizeDifficulty", () => {
  it("bands Codeforces ratings", () => {
    expect(normalizeDifficulty("codeforces", 800)).toBe(1);
    expect(normalizeDifficulty("codeforces", "1200")).toBe(2);
    expect(normalizeDifficulty("codeforces", 1999)).toBe(3);
    expect(normalizeDifficulty("codeforces", 2000)).toBe(4);
    expect(normalizeDifficulty("codeforces", 3500)).toBe(5);
  });

  it("bands AtCoder models, including negative ones", () => {
    expect(normalizeDifficulty("atcoder", -1200)).toBe(1);
    expect(normalizeDifficulty("atcoder", 400)).toBe(2);
    expect(normalizeDifficulty("atcoder", 1199)).toBe(3);
    expect(normalizeDifficulty("atcoder", 4383)).toBe(5);
  });

  it("maps LeetCode labels case-insensitively", () => {
    expect(normalizeDifficulty("leetcode", "Easy")).toBe(1);
    expect(normalizeDifficulty("leetcode", "MEDIUM")).toBe(3);
    expect(normalizeDifficulty("leetcode", "Hard")).toBe(4);
    expect(normalizeDifficulty("leetcode", "Extreme")).toBeNull();
  });

  it("returns null when unrated", () => {
    expect(normalizeDifficulty("codeforces", undefined)).toBeNull();
    expect(normalizeDifficulty("codeforces", "")).toBeNull();
    expect(normalizeDifficulty("atcoder", "n/a")).toBeNull();
  });
});

describe("cursor", () => {
  it("parses a cursor for the matching platform only", () => {
    const cf = { platform: "codeforces", maxSubmissionId: 42 };
    expect(parseCursor("codeforces", cf)).toEqual(cf);
    expect(parseCursor("atcoder", cf)).toBeNull();
    expect(parseCursor("codeforces", { platform: "codeforces" })).toBeNull();
    expect(parseCursor("codeforces", null)).toBeNull();
  });

  it("keeps the last reported cursor, else the starting one", () => {
    const start = { platform: "atcoder", fromSecond: 10 } as const;
    const a = { platform: "atcoder", fromSecond: 20 } as const;
    const b = { platform: "atcoder", fromSecond: 30 } as const;
    expect(resolveCursor(start, [a, null, b, null])).toEqual(b);
    expect(resolveCursor(start, [null, null])).toEqual(start);
    expect(resolveCursor(null, [])).toBeNull();
  });
});

const solve = (id: string, t?: number, withFallback = true): NormalizedSolve => ({
  platform: "codeforces",
  externalProblemId: id,
  firstSolvedAt: t === undefined ? undefined : new Date(t * 1000),
  problemFallback: withFallback
    ? { title: `P ${id}`, url: `https://x/${id}`, difficultyRaw: 800, rawTags: ["dp", "dp"] }
    : undefined,
});

describe("rows", () => {
  it("dedupes solves keeping the earliest time and any fallback", () => {
    const out = dedupeSolves("codeforces", [
      solve("1A", 200, false),
      solve("1A", 100, false),
      solve("1A", 300, true),
      solve("2B"),
      { ...solve("x"), platform: "atcoder" },
    ]);
    expect(out).toHaveLength(2);
    const a = out.find((s) => s.externalProblemId === "1A");
    expect(a?.firstSolvedAt?.getTime()).toBe(100_000);
    expect(a?.problemFallback?.title).toBe("P 1A");
  });

  it("prefers a known time over an unknown one", () => {
    const [s] = dedupeSolves("codeforces", [solve("1A"), solve("1A", 50)]);
    expect(s?.firstSolvedAt?.getTime()).toBe(50_000);
  });

  it("builds stub rows only for solves with a fallback", () => {
    const rows = stubRows("codeforces", [solve("1A", 1), solve("2B", 1, false)]);
    expect(rows).toEqual([
      {
        platform: "codeforces",
        externalId: "1A",
        title: "P 1A",
        url: "https://x/1A",
        difficultyRaw: "800",
        difficultyNorm: 1,
        rawTags: ["dp"],
      },
    ]);
  });

  it("normalizes catalog rows and drops duplicate ids", () => {
    const rows = catalogRows([
      { platform: "leetcode", externalId: "two-sum", title: "Old", url: "u", rawTags: [] },
      {
        platform: "leetcode",
        externalId: "two-sum",
        title: "Two Sum",
        url: "u",
        difficultyRaw: "Easy",
        rawTags: ["array"],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Two Sum", difficultyRaw: "Easy", difficultyNorm: 1 });
  });

  it("keeps negative AtCoder difficulty as raw text", () => {
    const row = toProblemRow("atcoder", "abc1_a", {
      title: "A",
      url: "u",
      difficultyRaw: -342,
      rawTags: [],
    });
    expect(row).toMatchObject({ difficultyRaw: "-342", difficultyNorm: 1 });
  });

  it("chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
