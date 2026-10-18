import { describe, expect, it } from "vitest";
import { isValidUsername } from "@/lib/friends/username";
import { emailUsernameBase, usernameBase, usernameCandidates } from "@/lib/usernames";

describe("usernameBase", () => {
  it("lowercases and keeps dots, underscores and dashes", () => {
    expect(usernameBase("John.Doe_x-y")).toBe("john.doe_x-y");
  });
  it("strips accents", () => {
    expect(usernameBase("José Álvarez")).toBe("jose-alvarez");
  });
  it("collapses junk runs and trims punctuation", () => {
    expect(usernameBase("  ..a!!!b--c__ ")).toBe("a-b-c");
  });
  it("returns null for symbols only or a single char", () => {
    expect(usernameBase("!!!")).toBeNull();
    expect(usernameBase("a")).toBeNull();
    expect(usernameBase("-a-")).toBeNull();
  });
  it("cuts to 39 chars and re-trims", () => {
    const long = usernameBase("a".repeat(60));
    expect(long).toBe("a".repeat(39));
    const cut = usernameBase(`${"a".repeat(38)}.${"b".repeat(10)}`);
    expect(cut).toBe("a".repeat(38));
  });
});

describe("emailUsernameBase", () => {
  it("uses the local part", () => {
    expect(emailUsernameBase("Savinyu.Pant@gmail.com")).toBe("savinyu.pant");
  });
  it("drops +tags", () => {
    expect(emailUsernameBase("sam+codelogs@example.com")).toBe("sam");
  });
  it("returns null for an unusable local part", () => {
    expect(emailUsernameBase("a@example.com")).toBeNull();
  });
});

describe("usernameCandidates", () => {
  it("numbers from 2", () => {
    expect(usernameCandidates("sam", 4)).toEqual(["sam", "sam-2", "sam-3", "sam-4"]);
  });
  it("defaults to 20 valid, unique candidates", () => {
    const c = usernameCandidates("sam");
    expect(c).toHaveLength(20);
    expect(new Set(c).size).toBe(20);
  });
  it("shortens the base, not the suffix, for long bases", () => {
    const c = usernameCandidates("a".repeat(39));
    expect(c[0]).toBe("a".repeat(39));
    expect(c[1]).toBe(`${"a".repeat(37)}-2`);
    for (const name of c) {
      expect(name.length).toBeLessThanOrEqual(39);
      expect(isValidUsername(name)).toBe(true);
    }
  });
  it("re-trims punctuation left at the cut", () => {
    const c = usernameCandidates(`${"a".repeat(35)}.bcd`, 12);
    for (const name of c) expect(isValidUsername(name)).toBe(true);
    expect(c[11]).toBe(`${"a".repeat(35)}-12`);
  });
});
