import { describe, expect, it } from "vitest";
import { displayHandle } from "../lib/platforms";

describe("displayHandle", () => {
  it("shortens a Code360 profile UUID", () => {
    expect(displayHandle("code360", "2ce16de6-43e6-4360-8896-8839c0a26891")).toBe("2ce16de6…");
  });

  it("keeps a short Code360 id and every other platform's handle", () => {
    expect(displayHandle("code360", "ab12cd34")).toBe("ab12cd34");
    expect(displayHandle("gfg", "a-very-long-geeksforgeeks-handle-1234")).toBe(
      "a-very-long-geeksforgeeks-handle-1234",
    );
  });
});
