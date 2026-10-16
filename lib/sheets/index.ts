// Sheet definitions and progress. Pure: the server passes in the user's solved LeetCode slugs.

import { NEETCODE_PROBLEMS } from "./neetcode-data";
import type { NeetcodeProblem, Sheet, SheetDifficulty, SheetId, SheetProgress } from "./types";

export type * from "./types";

const NEETCODE_SOURCE = { label: "NeetCode", url: "https://neetcode.io/practice" };

function sectionsOf(problems: readonly NeetcodeProblem[]): Sheet["sections"] {
  const bySection = new Map<string, Sheet["sections"][number]>();
  for (const p of problems) {
    let section = bySection.get(p.section);
    if (!section) bySection.set(p.section, (section = { name: p.section, problems: [] }));
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
    source: NEETCODE_SOURCE,
    sections: sectionsOf(NEETCODE_PROBLEMS.filter((p) => p.blind75)),
  },
  {
    id: "neetcode-150",
    name: "NeetCode 150",
    description: "Blind 75 plus 75 more, in NeetCode's roadmap order.",
    source: NEETCODE_SOURCE,
    sections: sectionsOf(NEETCODE_PROBLEMS),
  },
];

export const DEFAULT_SHEET: SheetId = "neetcode-150";

/** A sheet id from a search param; anything else is the default sheet. */
export function parseSheetId(value: unknown): SheetId {
  return SHEETS.some((s) => s.id === value) ? (value as SheetId) : DEFAULT_SHEET;
}

export function sheetProgress(sheet: Sheet, solvedSlugs: ReadonlySet<string>): SheetProgress {
  const byDifficulty: SheetProgress["byDifficulty"] = {
    Easy: { solved: 0, total: 0 },
    Medium: { solved: 0, total: 0 },
    Hard: { solved: 0, total: 0 },
  };
  const sections = sheet.sections.map((section) => {
    const problems = section.problems.map((p) => ({ ...p, solved: solvedSlugs.has(p.slug) }));
    for (const p of problems) {
      const d = byDifficulty[p.difficulty as SheetDifficulty];
      d.total++;
      if (p.solved) d.solved++;
    }
    return {
      name: section.name,
      solved: problems.filter((p) => p.solved).length,
      total: problems.length,
      problems,
    };
  });
  return {
    id: sheet.id,
    name: sheet.name,
    description: sheet.description,
    source: sheet.source,
    solved: sections.reduce((n, s) => n + s.solved, 0),
    total: sections.reduce((n, s) => n + s.total, 0),
    byDifficulty,
    sections,
  };
}

export function allSheetProgress(solvedSlugs: ReadonlySet<string>): SheetProgress[] {
  return SHEETS.map((s) => sheetProgress(s, solvedSlugs));
}
