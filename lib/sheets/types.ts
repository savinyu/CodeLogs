// Problem sheets (M9): curated LeetCode lists and progress through them. Pure types.

export type SheetDifficulty = "Easy" | "Medium" | "Hard";

/** One row of the generated NeetCode data (lib/sheets/neetcode-data.ts). */
export interface NeetcodeProblem {
  /** LeetCode title slug. */
  slug: string;
  title: string;
  /** NeetCode's pattern, used as the section: "Arrays & Hashing", "Two Pointers", … */
  section: string;
  difficulty: SheetDifficulty;
  blind75: boolean;
  /** LeetCode premium. */
  premium: boolean;
}

export type SheetId = "blind-75" | "neetcode-150";

export interface SheetProblem {
  slug: string;
  title: string;
  difficulty: SheetDifficulty;
  premium: boolean;
  url: string;
}

export interface Sheet {
  id: SheetId;
  name: string;
  description: string;
  source: { label: string; url: string };
  /** In the sheet's order; each problem appears once. */
  sections: { name: string; problems: SheetProblem[] }[];
}

export interface SectionProgress {
  name: string;
  solved: number;
  total: number;
  problems: (SheetProblem & { solved: boolean })[];
}

export interface SheetProgress {
  id: SheetId;
  name: string;
  description: string;
  source: { label: string; url: string };
  solved: number;
  total: number;
  /** Solved per difficulty, for the summary line. */
  byDifficulty: Record<SheetDifficulty, { solved: number; total: number }>;
  sections: SectionProgress[];
}
