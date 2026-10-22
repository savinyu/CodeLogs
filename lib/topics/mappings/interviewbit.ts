import type { TopicSlug } from "../taxonomy";

/**
 * InterviewBit tag → topics, keyed by interviewbitTagKey() (lowercase, "&" as "and"). Its tags
 * are the track topic ("Stacks And Queues") plus company names; anything not listed is unmapped.
 * [] = deliberately unmapped (not a technique, or too generic).
 */
export const INTERVIEWBIT_TAGS: Readonly<Record<string, readonly TopicSlug[]>> = {
  // Unmapped
  "time complexity": [], // multiple-choice questions, not coding problems
  arrays: [], // as LeetCode's "array": says nothing about the technique
  array: [],
  language: [],

  puzzles: ["constructive"],
  simulation: ["simulation"],
  math: ["math"],
  maths: ["math"],
  "number theory": ["number-theory"],
  "bit manipulation": ["bit-manipulation"],
  "binary search": ["binary-search"],
  "two pointers": ["two-pointers"],
  "sliding window": ["sliding-window"],
  strings: ["strings"],
  string: ["strings"],
  trie: ["tries"],
  tries: ["tries"],
  hashing: ["hashing-counting"],
  "linked lists": ["stacks-queues"],
  "linked list": ["stacks-queues"],
  "stacks and queues": ["stacks-queues"],
  stack: ["stacks-queues"],
  stacks: ["stacks-queues"],
  queue: ["stacks-queues"],
  queues: ["stacks-queues"],
  "heaps and maps": ["heaps"],
  heaps: ["heaps"],
  heap: ["heaps"],
  "segment tree": ["range-queries"],
  "union find": ["dsu"],
  "tree data structure": ["trees"],
  trees: ["trees"],
  tree: ["trees"],
  "binary search tree": ["binary-trees"],
  "dynamic programming": ["dp"],
  "greedy algorithm": ["greedy"],
  greedy: ["greedy"],
  sorting: ["sorting"],
  "graph data structure and algorithms": ["graphs"],
  graphs: ["graphs"],
  graph: ["graphs"],
  backtracking: ["backtracking"],
  recursion: ["recursion"],
};

/** InterviewBit's tags vary in case and spell "and" both ways; this is the table's key for one. */
export function interviewbitTagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/&/g, " and ").replace(/\s+/g, " ").trim();
}
