import { describe, expect, it } from "vitest";
import type { NormalizedSolve } from "@/lib/adapters/types";
import { parseCursor, resolveCursor } from "@/lib/sync/cursor";
import {
  difficultyTier,
  displayAtcoderDifficulty,
  normalizeDifficulty,
} from "@/lib/sync/difficulty";
import { catalogRows, chunk, dedupeSolves, stubRows, toProblemRow } from "@/lib/sync/rows";

describe("difficultyTier", () => {
  it("splits Codeforces ratings at 1100 / 1700", () => {
    expect(difficultyTier("codeforces", "800")).toBe("easy");
    expect(difficultyTier("codeforces", "1100")).toBe("easy");
    expect(difficultyTier("codeforces", "1200")).toBe("medium");
    expect(difficultyTier("codeforces", "1600")).toBe("medium");
    expect(difficultyTier("codeforces", "1700")).toBe("hard");
    expect(difficultyTier("codeforces", "3500")).toBe("hard");
  });
  it("uses LeetCode's own labels", () => {
    expect(difficultyTier("leetcode", "Easy")).toBe("easy");
    expect(difficultyTier("leetcode", "Medium")).toBe("medium");
    expect(difficultyTier("leetcode", "Hard")).toBe("hard");
  });
  it("splits AtCoder difficulties at 400 / 900", () => {
    expect(difficultyTier("atcoder", "-934")).toBe("easy");
    expect(difficultyTier("atcoder", "399")).toBe("easy");
    expect(difficultyTier("atcoder", "400")).toBe("medium");
    expect(difficultyTier("atcoder", "899")).toBe("medium");
    expect(difficultyTier("atcoder", "900")).toBe("hard");
    expect(difficultyTier("atcoder", "2802")).toBe("hard");
  });
  it("returns null for unknown values", () => {
    expect(difficultyTier("atcoder", "abc")).toBeNull();
    expect(difficultyTier("codeforces", "abc")).toBeNull();
    expect(difficultyTier("codeforces", null)).toBeNull();
    expect(difficultyTier("leetcode", "Unknown")).toBeNull();
  });
});

describe("displayAtcoderDifficulty", () => {
  it("keeps values from 400 up and squashes lower ones into (0, 400)", () => {
    expect(displayAtcoderDifficulty(1259)).toBe(1259);
    expect(displayAtcoderDifficulty(400)).toBe(400);
    expect(displayAtcoderDifficulty(146)).toBe(212);
    expect(displayAtcoderDifficulty(-934)).toBe(14);
    expect(displayAtcoderDifficulty(-193)).toBeGreaterThan(0);
  });
});

describe("normalizeDifficulty", () => {
  it("bands Codeforces ratings", () => {
    expect(normalizeDifficulty("codeforces", 800)).toBe(1);
    expect(normalizeDifficulty("codeforces", 1100)).toBe(1);
    expect(normalizeDifficulty("codeforces", "1200")).toBe(2);
    expect(normalizeDifficulty("codeforces", 1400)).toBe(3);
    expect(normalizeDifficulty("codeforces", 1600)).toBe(3);
    expect(normalizeDifficulty("codeforces", 1700)).toBe(4);
    expect(normalizeDifficulty("codeforces", 2000)).toBe(4);
    expect(normalizeDifficulty("codeforces", 2100)).toBe(5);
    expect(normalizeDifficulty("codeforces", 3500)).toBe(5);
  });

  it("bands AtCoder models, including negative ones", () => {
    expect(normalizeDifficulty("atcoder", -1200)).toBe(1);
    expect(normalizeDifficulty("atcoder", 400)).toBe(2);
    expect(normalizeDifficulty("atcoder", 899)).toBe(3);
    expect(normalizeDifficulty("atcoder", 900)).toBe(4);
    expect(normalizeDifficulty("atcoder", 1300)).toBe(5);
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
        paidOnly: false,
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
        paidOnly: true,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Two Sum",
      difficultyRaw: "Easy",
      difficultyNorm: 1,
      paidOnly: true,
    });
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
