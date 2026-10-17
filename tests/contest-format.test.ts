import { describe, expect, it } from "vitest";
import { contestFormat, contestTitle } from "../lib/dashboard/contest-format";

describe("contestFormat", () => {
  it("reads the division from Codeforces round names", () => {
    expect(contestFormat("codeforces", "Codeforces Round 848 (Div. 2)")).toBe("Div. 2");
    expect(contestFormat("codeforces", "Codeforces Round 849 (Div. 4)")).toBe("Div. 4");
    expect(contestFormat("codeforces", "Nebius Welcome Round (Div. 1 + Div. 2)")).toBe(
      "Div. 1 + 2",
    );
    expect(contestFormat("codeforces", "CodeTON Round 4 (Div. 1 + Div. 2, Rated, Prizes!)")).toBe(
      "Div. 1 + 2",
    );
  });
  it("names Educational and Global rounds", () => {
    expect(contestFormat("codeforces", "Educational Codeforces Round 142 (Rated for Div. 2)")).toBe(
      "Educational · Div. 2",
    );
    expect(contestFormat("codeforces", "Codeforces Global Round 27")).toBe("Global");
  });
  it("returns null when the name doesn't say", () => {
    expect(contestFormat("codeforces", "Kotlin Heroes: Episode 11")).toBeNull();
    expect(contestFormat("leetcode", "LeetCode Cup")).toBeNull();
  });
  it("reads LeetCode weekly and biweekly contests", () => {
    expect(contestFormat("leetcode", "Weekly Contest 416")).toBe("Weekly");
    expect(contestFormat("leetcode", "Biweekly Contest 140")).toBe("Biweekly");
  });
});

describe("contestTitle", () => {
  it("drops the trailing parenthetical", () => {
    expect(contestTitle("Codeforces Round 848 (Div. 2)")).toBe("Codeforces Round 848");
    expect(contestTitle("CodeTON Round 4 (Div. 1 + Div. 2, Rated, Prizes!)")).toBe(
      "CodeTON Round 4",
    );
  });
  it("leaves other names alone", () => {
    expect(contestTitle("Weekly Contest 416")).toBe("Weekly Contest 416");
    expect(contestTitle("(Div. 2)")).toBe("(Div. 2)");
  });
});
