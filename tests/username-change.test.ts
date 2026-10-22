import { describe, expect, it } from "vitest";
import { parseNewUsername } from "@/lib/username-change";

describe("parseNewUsername", () => {
  it("normalizes: trims, drops one @, lowercases", () => {
    expect(parseNewUsername("  @Anvi_K ", "old")).toEqual({ ok: true, username: "anvi_k" });
  });
  it("keeps dots, dashes and underscores inside the name", () => {
    expect(parseNewUsername("a.b-c_d", null)).toEqual({ ok: true, username: "a.b-c_d" });
  });
  it("rejects non-strings and empty input", () => {
    expect(parseNewUsername(undefined, null).ok).toBe(false);
    expect(parseNewUsername(42, null).ok).toBe(false);
    expect(parseNewUsername("   ", null)).toEqual({ ok: false, error: "Use 2 to 39 characters." });
  });
  it("enforces 2 to 39 characters", () => {
    expect(parseNewUsername("a", null).ok).toBe(false);
    expect(parseNewUsername("ab", null).ok).toBe(true);
    expect(parseNewUsername("a".repeat(39), null).ok).toBe(true);
    expect(parseNewUsername("a".repeat(40), null).ok).toBe(false);
  });
  it("rejects other characters", () => {
    for (const bad of ["has space", "émile", "a/b", "a+b", "<x>"]) {
      expect(parseNewUsername(bad, null)).toEqual({
        ok: false,
        error: "Use only letters, numbers, dots, dashes and underscores.",
      });
    }
  });
  it("needs a letter or number at both ends", () => {
    for (const bad of [".ab", "ab-", "_ab", "--"]) {
      expect(parseNewUsername(bad, null)).toEqual({
        ok: false,
        error: "Start and end with a letter or number.",
      });
    }
  });
  it("rejects reserved names in any case", () => {
    expect(parseNewUsername("Admin", null)).toEqual({
      ok: false,
      error: "That username is reserved.",
    });
    expect(parseNewUsername("codelogs", null).ok).toBe(false);
    expect(parseNewUsername("logn", null).ok).toBe(false);
  });
  it("rejects the current username", () => {
    expect(parseNewUsername("@Savinyu", "savinyu")).toEqual({
      ok: false,
      error: "That is already your username.",
    });
  });
});
