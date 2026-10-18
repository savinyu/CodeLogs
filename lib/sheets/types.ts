// Problem sheets (M9, extended in v2): curated LeetCode lists and progress through them. Pure types.

import type { MacroSlug } from "@/lib/topics/taxonomy";

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

export type SheetId = "blind-75" | "neetcode-150" | "striver-180";

/** A LeetCode problem on a sheet. Only these can be matched to solves. */
export interface SheetProblem {
  slug: string;
  title: string;
  difficulty: SheetDifficulty;
  premium: boolean;
  url: string;
}

/** A sheet problem hosted elsewhere (GFG, Coding Ninjas): listed, never counted. */
export interface OffPlatformProblem {
  title: string;
  url: string;
  /** "GeeksforGeeks", "Coding Ninjas", … */
  site: string;
}

/** One section of the generated Striver data (lib/sheets/striver-data.ts); the topic is added in index.ts. */
export interface StriverSection {
  name: string;
  problems: SheetProblem[];
  offPlatform: OffPlatformProblem[];
}

export interface SheetSection {
  name: string;
  /** The macro topic the section trains (Topics drawer, Today, the "Weak topics" filter). */
  topic: MacroSlug;
  problems: SheetProblem[];
  offPlatform?: OffPlatformProblem[];
}

/** Where a sheet's list comes from; `license` only when the list is openly licensed. */
export interface SheetSource {
  label: string;
  url: string;
  license?: string;
}

export interface Sheet {
  id: SheetId;
  name: string;
  description: string;
  /** One line for the sheet's card. */
  note: string;
  source: SheetSource;
  /** In the sheet's order; each problem appears once. */
  sections: SheetSection[];
}

/** synced = a solve we hold; ticked = marked "Solved it" by hand; null = not solved. */
export type SheetProblemStatus = "synced" | "ticked" | null;

export interface SectionProgress {
  name: string;
  topic: MacroSlug;
  /** Synced + ticked. */
  solved: number;
  /** LeetCode problems only. */
  total: number;
  problems: (SheetProblem & { status: SheetProblemStatus })[];
  offPlatform: OffPlatformProblem[];
}

export interface SheetProgress {
  id: SheetId;
  name: string;
  description: string;
  note: string;
  source: SheetSource;
  /** Synced + ticked, LeetCode problems only. */
  solved: number;
  /** Of `solved`, how many come from manual ticks. */
  ticked: number;
  /** LeetCode problems (the trackable total). */
  total: number;
  /** Problems on other sites, listed but not counted. */
  offPlatform: number;
  /** Solved per difficulty, for the summary line. */
  byDifficulty: Record<SheetDifficulty, { solved: number; total: number }>;
  sections: SectionProgress[];
}

/** Everything a page needs to show sheets for one user (lib/sheets/queries.ts). */
export interface SheetState {
  /** Known LeetCode solves, every source. */
  solvedSlugs: Set<string>;
  /** Manual "Solved it" ticks. */
  tickedSlugs: Set<string>;
  /** Followed sheets, in SHEETS order. */
  followed: SheetId[];
  /** Whether the LeetCode account's full history is imported; null without a LeetCode account. */
  historyComplete: boolean | null;
}
