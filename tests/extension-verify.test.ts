import { describe, expect, it } from "vitest";
import manifest from "../extension/manifest.json";
import { describeLeetcodeResult, describeVerifyResult } from "../extension/lib/describe.js";
import { INJECTED } from "../extension/lib/inject.js";
import { ALL_PLATFORMS, SYNC_PLATFORMS, VERIFY_PLATFORMS } from "../extension/lib/registry.js";
import { planVerify } from "../extension/lib/verify-plan.js";
import { atcoder, codeforces } from "../extension/lib/verifiers.js";
import { ReaderError } from "../extension/lib/common.js";
import { fakePage } from "./extension-helpers";

describe("verifier identity", () => {
  it("AtCoder reads the userScreenName global in the page's own world", async () => {
    const page = fakePage({ routes: [], identity: ["chokudai"] });
    expect(await page.context(atcoder).identity()).toBe("chokudai");
    expect(atcoder.identitySteps[0]).toMatchObject({
      fn: "readGlobal",
      args: [["userScreenName"]],
      world: "MAIN",
    });
  });
  it("Codeforces reads the header profile link", async () => {
    const page = fakePage({ routes: [], identity: ["tourist"] });
    expect(await page.context(codeforces).identity()).toBe("tourist");
    expect(codeforces.identitySteps[0]?.fn).toBe("readSelectorLinkHandle");
    expect(Object.keys(INJECTED)).toContain("readSelectorLinkHandle");
  });
  it("logged out (empty or missing) is null", async () => {
    for (const v of [atcoder, codeforces]) {
      expect(
        await fakePage({ routes: [], identity: [""] })
          .context(v)
          .identity(),
      ).toBeNull();
      expect(
        await fakePage({ routes: [], identity: [null] })
          .context(v)
          .identity(),
      ).toBeNull();
    }
  });
});

describe("registry", () => {
  it("lists rows in the site's order: Codeforces, AtCoder, LeetCode, then the five", () => {
    expect(ALL_PLATFORMS.map((p) => p.id)).toEqual([
      "codeforces",
      "atcoder",
      "leetcode",
      "codechef",
      "code360",
      "hackerrank",
      "interviewbit",
      "gfg",
    ]);
    expect(SYNC_PLATFORMS.map((p) => p.id)).not.toContain("codeforces");
    expect(VERIFY_PLATFORMS.every((p) => p.kind === "verify")).toBe(true);
  });
  it("has the verify origins as optional host permissions", () => {
    for (const p of VERIFY_PLATFORMS) {
      for (const o of p.permissions) {
        expect(manifest.optional_host_permissions).toContain(o);
        expect(manifest.host_permissions).not.toContain(o);
      }
    }
  });
});

describe("planVerify", () => {
  const handles = {
    codeforces: { handle: "tourist", verified: false },
    atcoder: { handle: "chokudai", verified: true },
  };
  it("reads the tab only for an unverified, connected handle", () => {
    expect(planVerify(handles, "codeforces", "Codeforces", false)).toEqual({ action: "read" });
  });
  it("skips the tab when already verified", () => {
    expect(planVerify(handles, "atcoder", "AtCoder", true)).toEqual({
      action: "done",
      result: { already: true, handle: "chokudai" },
    });
  });
  it("not connected: quiet when automatic, an error when asked for", () => {
    expect(planVerify({}, "atcoder", "AtCoder", true)).toEqual({
      action: "done",
      result: { notConnected: true },
    });
    expect(() => planVerify(undefined, "atcoder", "AtCoder", false)).toThrow(ReaderError);
    expect(() => planVerify({}, "codeforces", "Codeforces", false)).toThrow(
      "Add your Codeforces handle on the CodeLogs Connect page first.",
    );
  });
});

describe("describers", () => {
  it("describeVerifyResult", () => {
    expect(describeVerifyResult({ handle: "savinyu" })).toBe("Verified @savinyu.");
    expect(describeVerifyResult({ handle: "savinyu", already: true })).toBe(
      "Already verified as @savinyu.",
    );
    expect(describeVerifyResult({ already: true })).toBe("Already verified.");
  });
  it("describeLeetcodeResult mentions a handle only when this sync verified it", () => {
    expect(describeLeetcodeResult({ imported: 1, complete: true, newlyVerified: true })).toContain(
      "now verified",
    );
    expect(
      describeLeetcodeResult({ imported: 1, complete: true, newlyVerified: false }),
    ).not.toContain("verified");
  });
});
