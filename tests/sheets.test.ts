import { describe, expect, it } from "vitest";
import {
  allSheetProgress,
  parseSheetId,
  SHEETS,
  sectionsTraining,
  sheetNamesBySlug,
  sheetProgress,
} from "@/lib/sheets";
import { followedSheets } from "@/lib/sheets/follow";
import { MACRO_SLUGS } from "@/lib/topics/taxonomy";
import { NEETCODE_PROBLEMS } from "@/lib/sheets/neetcode-data";
import { STRIVER_SECTIONS } from "@/lib/sheets/striver-data";

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

describe("Striver's 180 data", () => {
  const striver = sheet("striver-180");

  it("lists each LeetCode problem once, with valid slugs and URLs", () => {
    const all = slugs("striver-180");
    expect(all.length).toBeGreaterThanOrEqual(140);
    expect(new Set(all).size).toBe(all.length);
    for (const section of striver.sections) {
      for (const p of section.problems) {
        expect(p.slug).toMatch(/^[a-z0-9-]+$/);
        expect(p.url).toBe(`https://leetcode.com/problems/${p.slug}/`);
        expect(["Easy", "Medium", "Hard"]).toContain(p.difficulty);
      }
    }
  });

  it("keeps the sheet's sections, each with a topic, and lists takeUforward problems", () => {
    expect(striver.sections.map((s) => s.name).slice(0, 3)).toEqual([
      "Arrays",
      "Hashing",
      "Binary Search",
    ]);
    expect(striver.sections).toHaveLength(STRIVER_SECTIONS.length);
    for (const section of striver.sections) expect(MACRO_SLUGS).toContain(section.topic);
    const off = striver.sections.flatMap((s) => s.offPlatform ?? []);
    expect(off.length).toBeGreaterThan(0);
    for (const o of off) {
      expect(o.site).toBe("takeUforward");
      expect(o.url).toMatch(/^https:\/\/takeuforward\.org\/practice\/dsa\/[^/?#]+$/);
    }
  });

  it("counts off-platform problems apart and skips untracked sections for training", () => {
    const progress = sheetProgress(striver, new Set(["not-on-any-sheet", "majority-element"]));
    expect(progress.solved).toBe(1);
    expect(progress.offPlatform).toBeGreaterThan(0);
    const maths = progress.sections.find((s) => s.name === "Mathematics")!;
    expect(maths.total).toBe(0);
    expect(maths.offPlatform.length).toBeGreaterThan(0);
    const training = sectionsTraining([progress], "math").map((t) => t.section.name);
    expect(training).toContain("Bit Manipulation");
    expect(training).not.toContain("Mathematics");
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
    expect(arrays.problems.find((p) => p.slug === "two-sum")?.status).toBe("synced");
    expect(arrays.problems.find((p) => p.slug === "group-anagrams")?.status).toBeNull();
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
      ["striver-180", 0, 144],
    ]);
  });
});

describe("ticks, topics and follows", () => {
  it("counts manual ticks as solved, and a synced solve wins over a tick", () => {
    const nc = sheetProgress(
      sheet("neetcode-150"),
      new Set(["two-sum"]),
      new Set(["two-sum", "lru-cache"]),
    );
    expect(nc.solved).toBe(2);
    expect(nc.ticked).toBe(1);
    const all = nc.sections.flatMap((s) => s.problems);
    expect(all.find((p) => p.slug === "two-sum")?.status).toBe("synced");
    expect(all.find((p) => p.slug === "lru-cache")?.status).toBe("ticked");
  });

  it("maps every section to a macro topic", () => {
    for (const s of SHEETS) {
      for (const section of s.sections) expect(MACRO_SLUGS).toContain(section.topic);
    }
    const graphs = sectionsTraining(allSheetProgress(new Set()), "graphs");
    expect(graphs.map((g) => `${g.sheetId}/${g.section.name}`)).toContain(
      "neetcode-150/Advanced Graphs",
    );
  });

  it("names the followed sheets that contain a slug", () => {
    const names = sheetNamesBySlug(["blind-75", "neetcode-150"]);
    expect(names.get("two-sum")).toEqual(["Blind 75", "NeetCode 150"]);
    expect(sheetNamesBySlug(["blind-75"]).get("lru-cache")).toBeUndefined();
  });

  it("follows nothing by default, and honours explicit choices", () => {
    expect(followedSheets(new Map())).toEqual([]);
    expect(followedSheets(new Map([["striver-180", true]]))).toEqual(["striver-180"]);
    expect(
      followedSheets(
        new Map([
          ["neetcode-150", false],
          ["blind-75", true],
        ]),
      ),
    ).toEqual(["blind-75"]);
  });
});

describe("parseSheetId", () => {
  it("accepts known ids and falls back to NeetCode 150", () => {
    expect(parseSheetId("blind-75")).toBe("blind-75");
    expect(parseSheetId("nope")).toBe("neetcode-150");
    expect(parseSheetId(undefined)).toBe("neetcode-150");
  });
});
