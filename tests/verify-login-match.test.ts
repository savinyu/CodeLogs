import { describe, expect, it } from "vitest";
import { decideVerify, extensionVerifySchema } from "@/lib/extension-verify-shared";

describe("extensionVerifySchema", () => {
  it("accepts Codeforces and AtCoder with a plain username", () => {
    expect(
      extensionVerifySchema.parse({ platform: "codeforces", loggedInAs: " savinyu " }),
    ).toEqual({ platform: "codeforces", loggedInAs: "savinyu" });
    expect(
      extensionVerifySchema.safeParse({ platform: "atcoder", loggedInAs: "chokudai" }).success,
    ).toBe(true);
  });

  it("rejects other platforms and odd usernames", () => {
    for (const body of [
      { platform: "leetcode", loggedInAs: "x" },
      { platform: "gfg", loggedInAs: "x" },
      { platform: "codeforces", loggedInAs: "" },
      { platform: "codeforces", loggedInAs: "a b" },
      { platform: "codeforces", loggedInAs: "<script>" },
      { platform: "codeforces", loggedInAs: "a".repeat(65) },
      { platform: "codeforces" },
    ]) {
      expect(extensionVerifySchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("decideVerify", () => {
  const body = { platform: "codeforces", loggedInAs: "Savinyu" } as const;

  it("connects the logged-in user when no handle is connected", () => {
    expect(decideVerify(null, body)).toEqual({ kind: "create" });
  });

  it("verifies a case-insensitive match and keeps the stored handle", () => {
    expect(decideVerify({ handle: "savinyu", verified: false }, body)).toEqual({
      kind: "verify",
      handle: "savinyu",
    });
  });

  it("reports an already verified handle", () => {
    expect(decideVerify({ handle: "savinyu", verified: true }, body)).toEqual({
      kind: "already",
      handle: "savinyu",
    });
  });

  it("refuses a different logged-in user, naming both", () => {
    const d = decideVerify({ handle: "tourist", verified: false }, body);
    expect(d).toMatchObject({ kind: "error", status: 409 });
    expect(d.kind === "error" && d.error).toBe(
      "This browser is logged in to Codeforces as Savinyu, but your connected Codeforces handle is tourist. Remove it on the Connect page to switch.",
    );
  });
});
