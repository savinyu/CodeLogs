import { describe, expect, it } from "vitest";
import { formatRelative } from "@/lib/relative-time";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatRelative", () => {
  it("reads minutes, hours, yesterday and days", () => {
    expect(formatRelative(ago(20_000), NOW)).toBe("just now");
    expect(formatRelative(ago(5 * 60_000), NOW)).toBe("5 min ago");
    expect(formatRelative(ago(3 * 3_600_000), NOW)).toBe("3 h ago");
    expect(formatRelative(ago(30 * 3_600_000), NOW)).toBe("yesterday");
    expect(formatRelative(ago(4 * 86_400_000), NOW)).toBe("4 days ago");
  });
  it("uses a date after a month, and handles missing or bad input", () => {
    expect(formatRelative("2026-03-04T10:00:00Z", NOW)).toBe("4 Mar 2026");
    expect(formatRelative(null, NOW)).toBe("date unknown");
    expect(formatRelative("nope", NOW)).toBe("date unknown");
  });
  it("treats a future time as just now", () => {
    expect(formatRelative(ago(-60_000), NOW)).toBe("just now");
  });
});
