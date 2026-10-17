import { describe, expect, it } from "vitest";
import type { MacroTopicStat } from "@/lib/dashboard/types";
import { coverageStep, publicStep, topicState, topicViews } from "@/lib/topics/view";

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
});
