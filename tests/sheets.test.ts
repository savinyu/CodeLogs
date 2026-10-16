import { describe, expect, it } from "vitest";
import { allSheetProgress, parseSheetId, SHEETS, sheetProgress } from "@/lib/sheets";
import { NEETCODE_PROBLEMS } from "@/lib/sheets/neetcode-data";

const sheet = (id: string) => SHEETS.find((s) => s.id === id)!;
const slugs = (id: string) => sheet(id).sections.flatMap((s) => s.problems.map((p) => p.slug));

describe("sheet data", () => {
  it("has 150 NeetCode problems, 75 of them Blind 75, each once", () => {
    expect(slugs("neetcode-150")).toHaveLength(150);
    expect(new Set(slugs("neetcode-150")).size).toBe(150);
    expect(slugs("blind-75")).toHaveLength(75);
    const nc = new Set(slugs("neetcode-150"));
    expect(slugs("blind-75").every((s) => nc.has(s))).toBe(true);
  });

  it("uses valid slugs, difficulties and LeetCode URLs", () => {
    for (const p of NEETCODE_PROBLEMS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(["Easy", "Medium", "Hard"]).toContain(p.difficulty);
    }
    const first = sheet("neetcode-150").sections[0]!;
    expect(first.name).toBe("Arrays & Hashing");
    expect(first.problems[0]!.url).toMatch(/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/);
  });

  it("keeps NeetCode's section order and marks premium problems", () => {
    const names = sheet("neetcode-150").sections.map((s) => s.name);
    expect(names.slice(0, 3)).toEqual(["Arrays & Hashing", "Two Pointers", "Sliding Window"]);
    expect(names).toHaveLength(18);
    const premium = NEETCODE_PROBLEMS.filter((p) => p.premium).map((p) => p.slug);
    expect(premium).toContain("meeting-rooms");
    expect(premium).toHaveLength(7);
  });
});

describe("sheetProgress", () => {
  it("counts solved problems per sheet, section and difficulty", () => {
    const solved = new Set(["two-sum", "valid-anagram", "lru-cache", "not-on-any-sheet"]);
    const nc = sheetProgress(sheet("neetcode-150"), solved);
    expect(nc.solved).toBe(3);
    expect(nc.total).toBe(150);
    const arrays = nc.sections.find((s) => s.name === "Arrays & Hashing")!;
    expect(arrays.solved).toBe(2);
    expect(arrays.problems.find((p) => p.slug === "two-sum")?.solved).toBe(true);
    expect(arrays.problems.find((p) => p.slug === "group-anagrams")?.solved).toBe(false);
    expect(nc.byDifficulty.Easy.solved).toBe(2);
    expect(nc.byDifficulty.Medium.solved).toBe(1);
    const totals = Object.values(nc.byDifficulty).reduce((n, d) => n + d.total, 0);
    expect(totals).toBe(150);
  });

  it("is zero with no solves, and covers every sheet", () => {
    const all = allSheetProgress(new Set());
    expect(all.map((p) => [p.id, p.solved, p.total])).toEqual([
      ["blind-75", 0, 75],
      ["neetcode-150", 0, 150],
    ]);
  });
});

describe("parseSheetId", () => {
  it("accepts known ids and falls back to NeetCode 150", () => {
    expect(parseSheetId("blind-75")).toBe("blind-75");
    expect(parseSheetId("nope")).toBe("neetcode-150");
    expect(parseSheetId(undefined)).toBe("neetcode-150");
  });
});
