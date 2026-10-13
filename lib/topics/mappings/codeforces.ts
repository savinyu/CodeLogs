import type { TopicSlug } from "../taxonomy";

/** Codeforces tag → topics. [] = deliberately unmapped (not a technique, or too generic). */
export const CODEFORCES_TAGS: Readonly<Record<string, readonly TopicSlug[]>> = {
  "*special": [],
  interactive: [],
  communication: [],

  implementation: ["simulation"],
  "constructive algorithms": ["constructive"],
  "brute force": ["brute-force"],

  greedy: ["greedy"],
  sortings: ["sorting"],
  schedules: ["sweep-line"],

  "binary search": ["binary-search"],
  "ternary search": ["binary-search"], // same family of search-on-answer techniques
  "two pointers": ["two-pointers"],

  "data structures": ["data-structures"],
  dsu: ["dsu"],

  dp: ["dp"],

  graphs: ["graphs"],
  "dfs and similar": ["graph-traversal"],
  "shortest paths": ["shortest-paths"],
  flows: ["flows-matching"],
  "graph matchings": ["flows-matching"],
  "2-sat": ["connectivity"],

  trees: ["trees"],

  math: ["math"],
  "number theory": ["number-theory"],
  "chinese remainder theorem": ["number-theory"],
  combinatorics: ["combinatorics"],
  probabilities: ["combinatorics"],
  bitmasks: ["bit-manipulation"], // usually bit tricks, not bitmask DP
  geometry: ["geometry"],
  games: ["game-theory"],
  matrices: ["algebra"],
  fft: ["algebra"],

  strings: ["strings"],
  hashing: ["string-matching"], // CF hashing is mostly string hashing
  "string suffix structures": ["suffix-structures"],
  "expression parsing": ["parsing"],

  "divide and conquer": ["divide-and-conquer"],
  "meet-in-the-middle": ["meet-in-the-middle"],
};
