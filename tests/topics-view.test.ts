import { describe, expect, it } from "vitest";
import type { MacroTopicStat } from "@/lib/dashboard/types";
import {
  coverageStep,
  noTopicMapReason,
  publicStep,
  topicState,
  topicViews,
} from "@/lib/topics/view";

describe("topicState", () => {
  it("splits at WEAK_BELOW and 1.1", () => {
    expect(topicState(0.79)).toBe("weak");
    expect(topicState(0.8)).toBe("ontrack");
    expect(topicState(1.1)).toBe("ontrack");
    expect(topicState(1.11)).toBe("strong");
  });
});

describe("coverageStep", () => {
  it("uses the five thresholds", () => {
    expect([0.49, 0.5, 0.79, 0.8, 0.99, 1, 1.2, 1.21].map(coverageStep)).toEqual([
      1, 2, 2, 3, 3, 4, 4, 5,
    ]);
  });
});

describe("publicStep", () => {
  it("uses 25/45/100", () => {
    expect([0, 24, 25, 44, 45, 99, 100].map(publicStep)).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });
});

describe("topicViews", () => {
  const stat = (slug: string, solved: number, expected: number) => ({
    slug,
    name: slug,
    platforms: [{ platform: "codeforces" as const, solved, weighted: solved, expected }],
  });
  const topics = [
    { ...stat("graphs", 2, 20), micros: [stat("bfs", 1, 10)] },
    { ...stat("dp", 30, 20), micros: [] },
  ] as unknown as MacroTopicStat[];

  it("derives state, step and the problems needed to leave weak", () => {
    const [graphs, dp] = topicViews(topics);
    expect(graphs!.state).toBe("weak");
    expect(graphs!.step).toBe(1);
    expect(graphs!.toLeaveWeak).toBe(14); // ceil(0.8 * 20) - 2
    expect(graphs!.micros[0]!.state).toBe("weak");
    expect(graphs!.platforms).toEqual([{ platform: "codeforces", solved: 2, expected: 20 }]);
    expect(dp!.state).toBe("strong");
    expect(dp!.step).toBe(5);
    expect(dp!.toLeaveWeak).toBe(0);
  });

  it("computes toLeaveWeak from the smoothed, weighted coverage", () => {
    const weighted = (solved: number, w: number, expected: number) => ({
      slug: "t",
      name: "t",
      micros: [],
      platforms: [{ platform: "codeforces" as const, solved, weighted: w, expected }],
    });
    const [none, light, exact] = topicViews([
      weighted(0, 0, 3),
      weighted(8, 2, 10),
      weighted(0, 0, 5), // 0.8 * 7 - 2 = 3.6000000000000005 -> 4
    ] as unknown as MacroTopicStat[]);
    expect(none!.state).toBe("weak");
    expect(none!.toLeaveWeak).toBe(2); // (2 + 2) / 5 = 0.8
    expect(light!.state).toBe("weak");
    expect(light!.toLeaveWeak).toBe(6); // ceil(0.8 * 12 - 2 - 2) = 6 (5 only reach 0.75)
    expect(exact!.toLeaveWeak).toBe(4);
  });
});

describe("noTopicMapReason", () => {
  it("names the tagless platforms in site order", () => {
    expect(noTopicMapReason(["gfg", "codechef"])).toBe(
      "No topic map yet. CodeChef and GeeksforGeeks have no problem tags. Connect Codeforces or LeetCode to see one.",
    );
    expect(noTopicMapReason(["atcoder"])).toBe(
      "No topic map yet. AtCoder has no problem tags. Connect Codeforces or LeetCode to see one.",
    );
  });

  it("explains an InterviewBit list with no mapped topic", () => {
    expect(noTopicMapReason(["interviewbit", "gfg"])).toBe(
      "No topic map yet. GeeksforGeeks has no problem tags. None of your InterviewBit solves so far is in a topic the map tracks. Connect Codeforces or LeetCode to see one.",
    );
  });

  it("waits for LeetCode's tag counts instead of asking to connect it", () => {
    expect(noTopicMapReason(["leetcode", "atcoder"])).toBe(
      "No topic map yet. AtCoder has no problem tags. LeetCode's topic counts haven't synced yet.",
    );
  });
});
