import { describe, expect, it } from "vitest";
import { isWithinOneDay } from "@/lib/today/day";

const now = Date.parse("2026-10-21T23:59:30Z");

describe("isWithinOneDay", () => {
  it("accepts yesterday, today and tomorrow", () => {
    expect(isWithinOneDay("2026-10-20", now)).toBe(true);
    expect(isWithinOneDay("2026-10-21", now)).toBe(true);
    expect(isWithinOneDay("2026-10-22", now)).toBe(true);
  });
  it("rejects days further away", () => {
    expect(isWithinOneDay("2026-10-19", now)).toBe(false);
    expect(isWithinOneDay("2026-10-23", now)).toBe(false);
  });
  it("rejects malformed or impossible dates", () => {
    expect(isWithinOneDay("2026-10-2", now)).toBe(false);
    expect(isWithinOneDay("2026-02-30", now)).toBe(false);
    expect(isWithinOneDay("", now)).toBe(false);
  });
  it("handles month boundaries", () => {
    expect(isWithinOneDay("2026-11-01", Date.parse("2026-10-31T12:00:00Z"))).toBe(true);
  });
});
