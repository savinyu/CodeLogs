import { describe, expect, it } from "vitest";
import cfTags from "@/fixtures/codeforces/tags.json";
import lcSlugs from "@/fixtures/leetcode/tag-slugs.json";
import lcCounts from "@/fixtures/leetcode/tag-counts.json";
import { TAXONOMY, isMacro, macroOf, type TopicSlug } from "@/lib/topics/taxonomy";
import { CODEFORCES_TAGS } from "@/lib/topics/mappings/codeforces";
import { LEETCODE_TAGS } from "@/lib/topics/mappings/leetcode";
import { tagsForTopic, topicsForTag } from "@/lib/topics/mappings";

const VALID = new Set<string>(TAXONOMY.flatMap((m) => [m.slug, ...m.micros.map((u) => u.slug)]));

describe("coverage of fixtures", () => {
  it("covers every Codeforces tag", () => {
    for (const { tag } of cfTags as { tag: string }[])
      expect(CODEFORCES_TAGS).toHaveProperty([tag]);
  });
  it("covers every LeetCode tag slug", () => {
    for (const slug of Object.keys(lcSlugs)) expect(LEETCODE_TAGS).toHaveProperty([slug]);
    const data = (lcCounts as { data: { matchedUser: { tagProblemCounts: object } } }).data
      .matchedUser.tagProblemCounts;
    for (const level of Object.values(data) as { tagSlug: string }[][])
      for (const { tagSlug } of level) expect(LEETCODE_TAGS).toHaveProperty([tagSlug]);
  });
});

describe.each([
  ["codeforces", CODEFORCES_TAGS],
  ["leetcode", LEETCODE_TAGS],
])("%s table", (_name, table) => {
  it("maps only valid, non-redundant, non-duplicate slugs", () => {
    for (const [tag, slugs] of Object.entries(table)) {
      expect(new Set(slugs).size, tag).toBe(slugs.length);
      for (const s of slugs) {
        expect(VALID.has(s), `${tag} -> ${s}`).toBe(true);
        if (!isMacro(s)) expect(slugs, tag).not.toContain(macroOf(s));
      }
    }
  });
});

describe("lookups", () => {
  it("resolves the done-when examples to dp", () => {
    expect(macroOf(CODEFORCES_TAGS["dp"]![0]!)).toBe("dp");
    expect(macroOf(LEETCODE_TAGS["dynamic-programming"]![0]!)).toBe("dp");
    expect(macroOf(LEETCODE_TAGS["memoization"]![0]!)).toBe("dp");
  });
  it("returns [] for AtCoder and unknown tags", () => {
    expect(topicsForTag("atcoder", "dp")).toEqual([]);
    expect(topicsForTag("codeforces", "nope")).toEqual([]);
    expect(topicsForTag("leetcode", "constructor")).toEqual([]);
  });
  it("tagsForTopic expands macros to micros", () => {
    const g = tagsForTopic("codeforces", "graphs");
    expect(g).toContain("graphs");
    expect(g).toContain("dfs and similar");
    expect(g).toContain("shortest paths");
    expect(g).not.toContain("dsu");
    const sp = tagsForTopic("leetcode", "shortest-paths");
    expect(sp).toContain("shortest-path");
    expect(sp).toContain("dijkstra");
    expect(sp).not.toContain("graph");
    expect(tagsForTopic("atcoder", "dp")).toEqual([]);
  });
  it("types check as TopicSlug", () => {
    const s: TopicSlug = "dp";
    expect(tagsForTopic("leetcode", s)).toContain("dynamic-programming");
  });
});
