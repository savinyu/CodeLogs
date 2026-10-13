import { describe, expect, it } from "vitest";
import { PLATFORMS } from "@/lib/db/schema";
import { fieldContainsToken, makeVerifyToken, VERIFY_FIELD } from "@/lib/verification";

describe("makeVerifyToken", () => {
  it("has the codelogs- prefix and 6 chars from the alphabet", () => {
    const token = makeVerifyToken();
    expect(token).toMatch(/^codelogs-[abcdefghjkmnpqrstuvwxyz23456789]{6}$/);
  });

  it("uses the injected random source", () => {
    const chars = ["a", "b", "2", "c", "d", "3"];
    let i = 0;
    expect(makeVerifyToken(() => chars[i++ % chars.length] ?? "a")).toBe("codelogs-ab2cd3");
  });

  it("varies between calls", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => makeVerifyToken()));
    expect(tokens.size).toBeGreaterThan(1);
  });
});

describe("fieldContainsToken", () => {
  const token = "codelogs-ab12cd";
  it("is false for null and empty", () => {
    expect(fieldContainsToken(null, token)).toBe(false);
    expect(fieldContainsToken("", token)).toBe(false);
  });
  it("matches case-insensitively", () => {
    expect(fieldContainsToken("CodeLogs-AB12CD", token)).toBe(true);
  });
  it("matches when surrounded by other text", () => {
    expect(fieldContainsToken("IIT Roorkee (codelogs-ab12cd) 2026", token)).toBe(true);
  });
  it("does not match a partial code", () => {
    expect(fieldContainsToken("codelogs-ab12c", token)).toBe(false);
    expect(fieldContainsToken("IIT Roorkee", token)).toBe(false);
  });
});

describe("VERIFY_FIELD", () => {
  it("covers every platform", () => {
    for (const p of PLATFORMS) {
      const f = VERIFY_FIELD[p];
      expect(f.label).toBeTruthy();
      expect(f.settingsUrl).toMatch(/^https:\/\//);
      expect(f.hint).toBeTruthy();
    }
  });
});
