import { describe, expect, it } from "vitest";
import {
  deleteConfirmationPhrase,
  exportFilename,
  isDeleteConfirmed,
} from "@/lib/account-export-shared";

describe("delete confirmation", () => {
  it("uses the username when there is one", () => {
    expect(deleteConfirmationPhrase("savinyu")).toBe("savinyu");
    expect(isDeleteConfirmed("savinyu", " savinyu ")).toBe(true);
    expect(isDeleteConfirmed("savinyu", "delete")).toBe(false);
  });
  it("falls back to the word delete", () => {
    expect(deleteConfirmationPhrase(null)).toBe("delete");
    expect(isDeleteConfirmed(null, "delete")).toBe(true);
    expect(isDeleteConfirmed(null, "")).toBe(false);
  });
});

describe("exportFilename", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  it("prefers the username", () => {
    expect(exportFilename("savinyu", "u1", now)).toBe("codelogs-savinyu-2026-10-13.json");
  });
  it("falls back to the id and sanitizes", () => {
    expect(exportFilename(null, 'a"b/c', now)).toBe("codelogs-a_b_c-2026-10-13.json");
  });
});
