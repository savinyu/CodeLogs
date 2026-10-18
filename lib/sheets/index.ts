// Sheet definitions and progress. Pure: the server passes in the user's solved and ticked slugs.

import type { MacroSlug } from "@/lib/topics/taxonomy";
import { NEETCODE_PROBLEMS } from "./neetcode-data";
import { STRIVER_SECTIONS } from "./striver-data";
import type {
  NeetcodeProblem,
  SectionProgress,
  Sheet,
  SheetDifficulty,
  SheetId,
  SheetProgress,
  SheetSection,
} from "./types";

export type * from "./types";

const NEETCODE_SOURCE = {
  label: "NeetCode",
  url: "https://neetcode.io/practice",
  license: "MIT license",
};

/** The macro topic each NeetCode pattern trains. */
export const NEETCODE_SECTION_TOPIC: Record<string, MacroSlug> = {
  "Arrays & Hashing": "data-structures",
  "Two Pointers": "search",
  "Sliding Window": "search",
  Stack: "data-structures",
  "Binary Search": "search",
  "Linked List": "data-structures",
  Trees: "trees",
  Tries: "strings",
  "Heap / Priority Queue": "data-structures",
  Backtracking: "recursion",
  Graphs: "graphs",
  "Advanced Graphs": "graphs",
  "1-D Dynamic Programming": "dp",
  "2-D Dynamic Programming": "dp",
  Greedy: "greedy-sorting",
  Intervals: "greedy-sorting",
  "Math & Geometry": "math",
  "Bit Manipulation": "math",
};

/** The macro topic each Striver's 180 section trains. */
export const STRIVER_SECTION_TOPIC: Record<string, MacroSlug> = {
  Arrays: "data-structures",
  Hashing: "data-structures",
  "Binary Search": "search",
  "Sliding Window and Two Pointers": "search",
  "Recursion and Backtracking": "recursion",
  "Linked List": "data-structures",
  "Stack and Queues": "data-structures",
  "Greedy Algorithms": "greedy-sorting",
  Heaps: "data-structures",
  "Binary Trees": "trees",
  "Binary Search Trees": "trees",
  Graphs: "graphs",
  "Dynamic Programming": "dp",
  Tries: "strings",
  Strings: "strings",
  "Bit Manipulation": "math",
  Mathematics: "math",
};

function striverSections(): SheetSection[] {
  return STRIVER_SECTIONS.map((s) => {
    const topic = STRIVER_SECTION_TOPIC[s.name];
    if (!topic) throw new Error(`No topic for Striver section "${s.name}"`);
    return { name: s.name, topic, problems: [...s.problems], offPlatform: [...s.offPlatform] };
  });
}

const striver = striverSections();
const count = (pick: (s: SheetSection) => number) => striver.reduce((n, s) => n + pick(s), 0);

function sectionsOf(problems: readonly NeetcodeProblem[]): SheetSection[] {
  const bySection = new Map<string, SheetSection>();
  for (const p of problems) {
    let section = bySection.get(p.section);
    if (!section) {
      const topic = NEETCODE_SECTION_TOPIC[p.section];
      if (!topic) throw new Error(`No topic for NeetCode section "${p.section}"`);
      bySection.set(p.section, (section = { name: p.section, topic, problems: [] }));
    }
    section.problems.push({
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      premium: p.premium,
      url: `https://leetcode.com/problems/${p.slug}/`,
    });
  }
  return [...bySection.values()];
}

export const SHEETS: readonly Sheet[] = [
  {
    id: "blind-75",
    name: "Blind 75",
    description: "The classic 75 interview problems, grouped by pattern.",
    note: "All 75 are in NeetCode 150, so one solve ticks both.",
    source: NEETCODE_SOURCE,
    sections: sectionsOf(NEETCODE_PROBLEMS.filter((p) => p.blind75)),
  },
  {
    id: "neetcode-150",
    name: "NeetCode 150",
    description: "Blind 75 plus 75 more, in NeetCode's roadmap order.",
    note: "18 sections, all LeetCode.",
    source: NEETCODE_SOURCE,
    sections: sectionsOf(NEETCODE_PROBLEMS),
  },
  {
    id: "striver-180",
    name: "Striver's 180",
    description: "takeUforward's pattern-wise sheet, from arrays to dynamic programming.",
    note: `${count((s) => s.problems.length)} LeetCode problems tracked; ${count((s) => s.offPlatform?.length ?? 0)} on takeUforward listed only.`,
    source: {
      label: "takeUforward",
      url: "https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns",
    },
    sections: striver,
  },
];

export const DEFAULT_SHEET: SheetId = "neetcode-150";

/** A sheet id from a search param; anything else is the default sheet. */
export function parseSheetId(value: unknown): SheetId {
  return SHEETS.some((s) => s.id === value) ? (value as SheetId) : DEFAULT_SHEET;
}

const NONE: ReadonlySet<string> = new Set();

/** Progress through one sheet. A synced solve wins over a manual tick of the same problem. */
export function sheetProgress(
  sheet: Sheet,
  solvedSlugs: ReadonlySet<string>,
  tickedSlugs: ReadonlySet<string> = NONE,
): SheetProgress {
  const byDifficulty: SheetProgress["byDifficulty"] = {
    Easy: { solved: 0, total: 0 },
    Medium: { solved: 0, total: 0 },
    Hard: { solved: 0, total: 0 },
  };
  let ticked = 0;
  const sections = sheet.sections.map((section): SectionProgress => {
    const problems = section.problems.map((p) => ({
      ...p,
      status: solvedSlugs.has(p.slug)
        ? ("synced" as const)
        : tickedSlugs.has(p.slug)
          ? ("ticked" as const)
          : null,
    }));
    for (const p of problems) {
      const d = byDifficulty[p.difficulty as SheetDifficulty];
      d.total++;
      if (p.status) d.solved++;
      if (p.status === "ticked") ticked++;
    }
    return {
      name: section.name,
      topic: section.topic,
      solved: problems.filter((p) => p.status).length,
      total: problems.length,
      problems,
      offPlatform: section.offPlatform ?? [],
    };
  });
  return {
    id: sheet.id,
    name: sheet.name,
    description: sheet.description,
    note: sheet.note,
    source: sheet.source,
    solved: sections.reduce((n, s) => n + s.solved, 0),
    ticked,
    total: sections.reduce((n, s) => n + s.total, 0),
    offPlatform: sections.reduce((n, s) => n + s.offPlatform.length, 0),
    byDifficulty,
    sections,
  };
}

export function allSheetProgress(
  solvedSlugs: ReadonlySet<string>,
  tickedSlugs: ReadonlySet<string> = NONE,
): SheetProgress[] {
  return SHEETS.map((s) => sheetProgress(s, solvedSlugs, tickedSlugs));
}

/** The sections of the given sheets that train `topic`, for the Topics drawer and Today. */
export function sectionsTraining(
  progress: readonly SheetProgress[],
  topic: MacroSlug,
): { sheetId: SheetId; sheetName: string; section: SectionProgress }[] {
  return progress.flatMap((p) =>
    p.sections
      // A section with no LeetCode problem has nothing to track (Striver's Mathematics).
      .filter((s) => s.topic === topic && s.total > 0)
      .map((section) => ({ sheetId: p.id, sheetName: p.name, section })),
  );
}

/** slug → names of the given sheets that contain it (the sheet chip on Today's picks). */
export function sheetNamesBySlug(sheetIds: readonly SheetId[]): Map<string, string[]> {
  const names = new Map<string, string[]>();
  for (const sheet of SHEETS) {
    if (!sheetIds.includes(sheet.id)) continue;
    for (const section of sheet.sections) {
      for (const p of section.problems)
        names.set(p.slug, [...(names.get(p.slug) ?? []), sheet.name]);
    }
  }
  return names;
}
