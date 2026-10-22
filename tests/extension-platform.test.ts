import { describe, expect, it } from "vitest";
import { buildPlatformSnapshot, matchAccount } from "@/lib/extension-platform-plan";
import {
  difficultySplit,
  EXT_COUNTS_KIND,
  extensionUploadSchema,
  isPlatformProblemUrl,
  type ExtensionUpload,
} from "@/lib/extension-upload";

type Solve = ExtensionUpload["solves"][number];

function solve(over: Partial<Solve> = {}): Solve {
  return {
    id: "two-sum",
    title: "Two Sum",
    url: "https://www.geeksforgeeks.org/problems/two-sum/1",
    difficulty: "Easy",
    tags: [],
    solvedAt: 1_700_000_000,
    ...over,
  };
}

function upload(over: Partial<ExtensionUpload> = {}): ExtensionUpload {
  return {
    platform: "gfg",
    loggedInAs: "alice",
    counts: null,
    solves: [],
    listComplete: true,
    activity: [],
    ...over,
  };
}

describe("buildPlatformSnapshot: solves", () => {
  it("maps a solve to a NormalizedSolve with fallback metadata", () => {
    const { snapshot, rejected, solveCount } = buildPlatformSnapshot(
      upload({ solves: [solve({ tags: ["array", "hash"] })] }),
    );
    expect(rejected).toBe(0);
    expect(solveCount).toBe(1);
    expect(snapshot.solves).toEqual([
      {
        platform: "gfg",
        externalProblemId: "two-sum",
        firstSolvedAt: new Date(1_700_000_000 * 1000),
        problemFallback: {
          title: "Two Sum",
          url: "https://www.geeksforgeeks.org/problems/two-sum/1",
          difficultyRaw: "Easy",
          rawTags: ["array", "hash"],
        },
      },
    ]);
  });

  it("leaves firstSolvedAt out for a null date and difficultyRaw undefined for a null label", () => {
    const { snapshot } = buildPlatformSnapshot(
      upload({ solves: [solve({ solvedAt: null, difficulty: null })] }),
    );
    const [s] = snapshot.solves;
    expect(s).toBeDefined();
    expect("firstSolvedAt" in s!).toBe(false);
    expect(s!.problemFallback?.difficultyRaw).toBeUndefined();
  });

  it("drops solves whose URL is off the platform's hosts or not https", () => {
    const { snapshot, rejected } = buildPlatformSnapshot(
      upload({
        solves: [
          solve({ id: "ok", url: "https://practice.geeksforgeeks.org/problems/x/1" }),
          solve({ id: "evil", url: "https://evil.example.com/problems/x/1" }),
          solve({ id: "lookalike", url: "https://geeksforgeeks.org.evil.com/p" }),
          solve({ id: "http", url: "http://www.geeksforgeeks.org/problems/x/1" }),
          solve({ id: "junk", url: "not a url" }),
          solve({ id: "other-platform", url: "https://www.hackerrank.com/challenges/x" }),
        ],
      }),
    );
    expect(snapshot.solves.map((s) => s.externalProblemId)).toEqual(["ok"]);
    expect(rejected).toBe(5);
  });

  it("filters against the upload's own platform", () => {
    const { snapshot } = buildPlatformSnapshot(
      upload({
        platform: "hackerrank",
        solves: [
          solve({ id: "a", url: "https://www.hackerrank.com/challenges/a/problem" }),
          solve({ id: "b", url: "https://www.geeksforgeeks.org/problems/b/1" }),
        ],
      }),
    );
    expect(snapshot.solves.map((s) => s.externalProblemId)).toEqual(["a"]);
    expect(snapshot.solves[0]?.platform).toBe("hackerrank");
  });

  it("dedupes by id keeping the earliest date", () => {
    const { snapshot, solveCount } = buildPlatformSnapshot(
      upload({
        solves: [
          solve({ solvedAt: 2000 }),
          solve({ solvedAt: 1000 }),
          solve({ solvedAt: 3000 }),
          solve({ id: "other", solvedAt: 5000 }),
        ],
      }),
    );
    expect(solveCount).toBe(2);
    const byId = new Map(snapshot.solves.map((s) => [s.externalProblemId, s]));
    expect(byId.get("two-sum")?.firstSolvedAt).toEqual(new Date(1000 * 1000));
    expect(byId.get("other")?.firstSolvedAt).toEqual(new Date(5000 * 1000));
  });

  it("a real date beats a null one in either order", () => {
    const first = buildPlatformSnapshot(
      upload({ solves: [solve({ solvedAt: null }), solve({ solvedAt: 1000 })] }),
    );
    expect(first.snapshot.solves[0]?.firstSolvedAt).toEqual(new Date(1_000_000));
    const second = buildPlatformSnapshot(
      upload({ solves: [solve({ solvedAt: 1000 }), solve({ solvedAt: null })] }),
    );
    expect(second.snapshot.solves[0]?.firstSolvedAt).toEqual(new Date(1_000_000));
  });

  it("does not count a rejected duplicate toward the snapshot", () => {
    const { snapshot, rejected } = buildPlatformSnapshot(
      upload({ solves: [solve(), solve({ url: "https://evil.example.com/x", solvedAt: 1 })] }),
    );
    expect(rejected).toBe(1);
    expect(snapshot.solves[0]?.firstSolvedAt).toEqual(new Date(1_700_000_000 * 1000));
  });

  it("stores GFG problem links under /1, which older extensions left off", () => {
    const url = (u: string, platform: ExtensionUpload["platform"] = "gfg") =>
      buildPlatformSnapshot(upload({ platform, solves: [solve({ url: u })] })).snapshot.solves[0]
        ?.problemFallback?.url;
    const fixed = "https://www.geeksforgeeks.org/problems/number-of-islands/1";
    expect(url("https://www.geeksforgeeks.org/problems/number-of-islands")).toBe(fixed);
    expect(url("https://www.geeksforgeeks.org/problems/number-of-islands/")).toBe(fixed);
    expect(url(fixed)).toBe(fixed);
    expect(url("https://www.geeksforgeeks.org/problems/x/0")).toBe(
      "https://www.geeksforgeeks.org/problems/x/0",
    );
    expect(url("https://www.interviewbit.com/problems/x/", "interviewbit")).toBe(
      "https://www.interviewbit.com/problems/x/",
    );
  });
});

describe("buildPlatformSnapshot: ext_counts", () => {
  it("adds no extra when counts is null", () => {
    expect(buildPlatformSnapshot(upload()).snapshot.extras).toEqual([]);
  });

  it("stores total, labels and the Easy/Medium/Hard split for GFG", () => {
    const byDifficulty = { School: 2, Basic: 3, Easy: 5, Medium: 4, Hard: 1 };
    const { snapshot } = buildPlatformSnapshot(upload({ counts: { total: 15, byDifficulty } }));
    expect(snapshot.extras).toEqual([
      {
        kind: EXT_COUNTS_KIND,
        payload: { total: 15, byDifficulty, split: { easy: 10, medium: 4, hard: 1 } },
      },
    ]);
  });

  it("InterviewBit: very_easy and easy both count as easy", () => {
    expect(difficultySplit("interviewbit", { very_easy: 4, easy: 6, medium: 2, hard: 1 })).toEqual({
      easy: 10,
      medium: 2,
      hard: 1,
    });
  });

  it("Code360: Moderate is medium, Ninja is hard", () => {
    const split = difficultySplit("code360", { Easy: 3, Moderate: 2, Hard: 1, Ninja: 1 });
    expect(split).toEqual({ easy: 3, medium: 2, hard: 2 });
  });

  it("ignores labels it can't place", () => {
    expect(difficultySplit("gfg", { Easy: 2, Mystery: 9 })).toEqual({
      easy: 2,
      medium: 0,
      hard: 0,
    });
  });

  it("is null when nothing maps", () => {
    expect(difficultySplit("gfg", { Mystery: 9 })).toBeNull();
    expect(difficultySplit("gfg", {})).toBeNull();
    const { snapshot } = buildPlatformSnapshot(
      upload({ counts: { total: 9, byDifficulty: { Mystery: 9 } } }),
    );
    expect(snapshot.extras[0]?.payload).toMatchObject({ total: 9, split: null });
  });
});

describe("buildPlatformSnapshot: activity and status", () => {
  it("passes the platform's own calendar through, sorted, one row per day (max wins)", () => {
    const { snapshot } = buildPlatformSnapshot(
      upload({
        platform: "hackerrank",
        activity: [
          { day: "2026-03-02", count: 1 },
          { day: "2026-03-01", count: 4 },
          { day: "2026-03-02", count: 6 },
          { day: "2026-03-01", count: 2 },
        ],
      }),
    );
    expect(snapshot.activity).toEqual([
      { day: "2026-03-01", count: 4 },
      { day: "2026-03-02", count: 6 },
    ]);
  });

  it("derives no activity from solve dates (the dashboard builds that from solves)", () => {
    const { snapshot } = buildPlatformSnapshot(upload({ solves: [solve()], activity: [] }));
    expect(snapshot.activity).toEqual([]);
  });

  it("a complete list is ok and historyComplete", () => {
    const plan = buildPlatformSnapshot(upload({ listComplete: true }));
    expect(plan.status).toBe("ok");
    expect(plan.historyComplete).toBe(true);
  });

  it("a partial or missing list is partial and not historyComplete", () => {
    const plan = buildPlatformSnapshot(upload({ listComplete: false }));
    expect(plan.status).toBe("partial");
    expect(plan.historyComplete).toBe(false);
  });
});

describe("matchAccount", () => {
  it("creates when nothing is connected", () => {
    expect(matchAccount(null, "Alice")).toEqual({ kind: "create" });
  });

  it("matches case-insensitively and takes the platform's casing", () => {
    expect(matchAccount({ handle: "alice" }, "Alice")).toEqual({ kind: "match", handle: "Alice" });
    expect(matchAccount({ handle: "ALICE" }, "alice")).toEqual({ kind: "match", handle: "alice" });
  });

  it("refuses a different handle and names the connected one", () => {
    expect(matchAccount({ handle: "bob" }, "alice")).toEqual({
      kind: "mismatch",
      connected: "bob",
    });
  });
});

describe("isPlatformProblemUrl", () => {
  it("accepts each platform's hosts over https only", () => {
    expect(isPlatformProblemUrl("codechef", "https://www.codechef.com/problems/FLOW001")).toBe(
      true,
    );
    expect(isPlatformProblemUrl("code360", "https://www.naukri.com/code360/problems/x")).toBe(true);
    expect(isPlatformProblemUrl("interviewbit", "https://www.interviewbit.com/problems/x/")).toBe(
      true,
    );
    expect(isPlatformProblemUrl("codechef", "http://www.codechef.com/problems/FLOW001")).toBe(
      false,
    );
    expect(isPlatformProblemUrl("codechef", "https://www.hackerrank.com/challenges/x")).toBe(false);
  });
});

describe("extensionUploadSchema", () => {
  const valid = {
    platform: "gfg",
    loggedInAs: "alice",
    counts: { total: 3, byDifficulty: { Easy: 3 } },
    solves: [solve()],
    listComplete: true,
    activity: [{ day: "2026-03-01", count: 2 }],
  };

  it("accepts a valid upload", () => {
    expect(extensionUploadSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts real calendar days, including leap days", () => {
    for (const day of ["2024-02-29", "2000-01-01", "2026-12-31"]) {
      const r = extensionUploadSchema.safeParse({ ...valid, activity: [{ day, count: 1 }] });
      expect(r.success, day).toBe(true);
    }
  });

  it("rejects activity days that are not real calendar days", () => {
    for (const day of ["2026-02-31", "2026-13-01", "0000-00-00", "2025-02-29", "1999-12-31"]) {
      const r = extensionUploadSchema.safeParse({ ...valid, activity: [{ day, count: 1 }] });
      expect(r.success, day).toBe(false);
    }
  });

  it("accepts null counts and empty lists", () => {
    expect(
      extensionUploadSchema.safeParse({ ...valid, counts: null, solves: [], activity: [] }).success,
    ).toBe(true);
  });

  it("rejects http problem URLs", () => {
    const res = extensionUploadSchema.safeParse({
      ...valid,
      solves: [solve({ url: "http://www.geeksforgeeks.org/problems/x/1" })],
    });
    expect(res.success).toBe(false);
  });

  it("rejects platforms the server syncs itself", () => {
    expect(extensionUploadSchema.safeParse({ ...valid, platform: "leetcode" }).success).toBe(false);
    expect(extensionUploadSchema.safeParse({ ...valid, platform: "codeforces" }).success).toBe(
      false,
    );
  });

  it("rejects an empty loggedInAs, a bad activity day and a negative count", () => {
    expect(extensionUploadSchema.safeParse({ ...valid, loggedInAs: "  " }).success).toBe(false);
    expect(
      extensionUploadSchema.safeParse({ ...valid, activity: [{ day: "03/01/2026", count: 1 }] })
        .success,
    ).toBe(false);
    expect(
      extensionUploadSchema.safeParse({ ...valid, counts: { total: -1, byDifficulty: {} } })
        .success,
    ).toBe(false);
  });

  it("requires listComplete", () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.listComplete;
    expect(extensionUploadSchema.safeParse(rest).success).toBe(false);
  });
});
