// The shared topic list: 10 macro topics for the UI, micro topics underneath for scoring and
// recommendations. Platform tags map onto these slugs in mappings/. Pure data, no imports.

export interface MacroTopic {
  slug: string;
  name: string;
  micros: { slug: string; name: string }[];
}

export const TAXONOMY = [
  {
    slug: "implementation",
    name: "Implementation",
    micros: [
      { slug: "simulation", name: "Simulation & Design" },
      { slug: "constructive", name: "Constructive & Ad hoc" },
      { slug: "brute-force", name: "Brute force & Enumeration" },
    ],
  },
  {
    slug: "greedy-sorting",
    name: "Greedy & Sorting",
    micros: [
      { slug: "greedy", name: "Greedy" },
      { slug: "sorting", name: "Sorting" },
      { slug: "sweep-line", name: "Intervals & Sweep line" },
    ],
  },
  {
    slug: "search",
    name: "Binary Search & Two Pointers",
    micros: [
      { slug: "binary-search", name: "Binary search" },
      { slug: "two-pointers", name: "Two pointers" },
      { slug: "sliding-window", name: "Sliding window" },
    ],
  },
  {
    slug: "data-structures",
    name: "Data Structures",
    micros: [
      { slug: "hashing-counting", name: "Hash maps & Counting" },
      { slug: "prefix-sums", name: "Prefix sums" },
      { slug: "stacks-queues", name: "Stacks, Queues & Lists" },
      { slug: "heaps", name: "Heaps & Ordered sets" },
      { slug: "range-queries", name: "Segment & Fenwick trees" },
      { slug: "dsu", name: "Union-Find" },
    ],
  },
  {
    slug: "dp",
    name: "Dynamic Programming",
    micros: [
      { slug: "knapsack", name: "Knapsack" },
      { slug: "sequence-dp", name: "Sequence DP (LIS, LCS)" },
      { slug: "bitmask-dp", name: "Bitmask DP" },
      { slug: "tree-dp", name: "DP on trees" },
    ],
  },
  {
    slug: "graphs",
    name: "Graphs",
    micros: [
      { slug: "graph-traversal", name: "BFS & DFS" },
      { slug: "shortest-paths", name: "Shortest paths" },
      { slug: "topological-sort", name: "DAGs & Topological sort" },
      { slug: "mst", name: "Minimum spanning trees" },
      { slug: "connectivity", name: "Connectivity (SCC, bridges, 2-SAT)" },
      { slug: "flows-matching", name: "Flows & Matching" },
    ],
  },
  {
    slug: "trees",
    name: "Trees",
    micros: [
      { slug: "binary-trees", name: "Binary trees & BSTs" },
      { slug: "tree-algorithms", name: "Tree algorithms (LCA, lifting)" },
    ],
  },
  {
    slug: "math",
    name: "Math",
    micros: [
      { slug: "number-theory", name: "Number theory" },
      { slug: "combinatorics", name: "Combinatorics & Probability" },
      { slug: "bit-manipulation", name: "Bit manipulation" },
      { slug: "geometry", name: "Geometry" },
      { slug: "game-theory", name: "Game theory" },
      { slug: "algebra", name: "Matrices & FFT" },
    ],
  },
  {
    slug: "strings",
    name: "Strings",
    micros: [
      { slug: "string-matching", name: "String matching & Hashing" },
      { slug: "suffix-structures", name: "Suffix structures & Palindromes" },
      { slug: "tries", name: "Tries" },
      { slug: "parsing", name: "Parsing & Brackets" },
    ],
  },
  {
    slug: "recursion",
    name: "Recursion & Divide and Conquer",
    micros: [
      { slug: "backtracking", name: "Backtracking" },
      { slug: "divide-and-conquer", name: "Divide and conquer" },
      { slug: "meet-in-the-middle", name: "Meet in the middle" },
    ],
  },
] as const satisfies readonly MacroTopic[];

export type MacroSlug = (typeof TAXONOMY)[number]["slug"];
export type MicroSlug = (typeof TAXONOMY)[number]["micros"][number]["slug"];
/** What a platform tag maps onto: a micro topic, or a macro directly for broad tags ("dp"). */
export type TopicSlug = MacroSlug | MicroSlug;

export const MACRO_SLUGS: readonly MacroSlug[] = TAXONOMY.map((m) => m.slug);

const PARENT = new Map<string, MacroSlug>(
  TAXONOMY.flatMap((m) => [
    [m.slug, m.slug] as const,
    ...m.micros.map((u) => [u.slug, m.slug] as const),
  ]),
);
const NAME = new Map<string, string>(
  TAXONOMY.flatMap((m) => [
    [m.slug, m.name] as const,
    ...m.micros.map((u) => [u.slug, u.name] as const),
  ]),
);

/** The macro topic a slug belongs to (a macro is its own parent). */
export function macroOf(slug: TopicSlug): MacroSlug {
  return PARENT.get(slug)!;
}

export function isMacro(slug: TopicSlug): slug is MacroSlug {
  return PARENT.get(slug) === slug;
}

export function topicName(slug: TopicSlug): string {
  return NAME.get(slug)!;
}
