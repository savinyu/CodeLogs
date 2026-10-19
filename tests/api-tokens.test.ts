import { describe, expect, it } from "vitest";
import {
  extensionLeetcodeSchema,
  generateToken,
  hashToken,
  isExtensionConnectRequest,
  parseBearer,
  parseTokenName,
  TOKEN_PATTERN,
  tokenPrefix,
} from "@/lib/api-tokens-shared";

describe("API tokens", () => {
  it("generates distinct tokens in the documented format", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(TOKEN_PATTERN);
    expect(b).toMatch(TOKEN_PATTERN);
    expect(a).not.toBe(b);
    expect(tokenPrefix(a)).toBe(a.slice(0, 9));
  });

  it("hashes with SHA-256 hex, deterministically", () => {
    const t = generateToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(hashToken(generateToken()));
  });

  it("reads only well-formed bearer tokens", () => {
    const t = generateToken();
    expect(parseBearer(`Bearer ${t}`)).toBe(t);
    expect(parseBearer(`bearer   ${t} `)).toBe(t);
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer(t)).toBeNull();
    expect(parseBearer("Bearer cl_short")).toBeNull();
    expect(parseBearer(`Basic ${t}`)).toBeNull();
    expect(parseBearer(`Bearer ${t} extra`)).toBeNull();
  });

  it("names tokens, with a default and a length cap", () => {
    expect(parseTokenName("  Work   laptop ")).toBe("Work laptop");
    expect(parseTokenName("")).toBe("Browser extension");
    expect(parseTokenName(null)).toBe("Browser extension");
    expect(parseTokenName("x".repeat(61))).toBeNull();
  });
});

describe("extension upload schema", () => {
  const ok = { userName: "CptDailyBird", solves: [{ slug: "two-sum", solvedAt: 1700000000 }] };

  it("accepts slugs with or without dates", () => {
    expect(extensionLeetcodeSchema.safeParse(ok).success).toBe(true);
    expect(
      extensionLeetcodeSchema.safeParse({ ...ok, solves: [{ slug: "two-sum", solvedAt: null }] })
        .success,
    ).toBe(true);
  });

  it.each([
    ["an empty user name", { ...ok, userName: "  " }],
    ["no solves", { ...ok, solves: [] }],
    ["a bad slug", { ...ok, solves: [{ slug: "../etc", solvedAt: null }] }],
    ["a millisecond timestamp", { ...ok, solves: [{ slug: "a", solvedAt: 1700000000000 }] }],
    ["a missing solvedAt", { ...ok, solves: [{ slug: "a" }] }],
    [
      "too many solves",
      { ...ok, solves: Array.from({ length: 5001 }, () => ({ slug: "a", solvedAt: null })) },
    ],
  ])("rejects %s", (_name, body) => {
    expect(extensionLeetcodeSchema.safeParse(body).success).toBe(false);
  });
});

describe("isExtensionConnectRequest", () => {
  const url = "https://codelogs.example/api/extension/connect";
  const good = { "x-codelogs-extension": "connect", origin: "https://codelogs.example" };
  const check = (h: Record<string, string>) => isExtensionConnectRequest(new Headers(h), url);

  it("accepts the extension header from our own origin", () => {
    expect(check(good)).toBe(true);
  });
  it("rejects a missing header", () => {
    expect(check({ origin: good.origin })).toBe(false);
  });
  it("rejects a wrong header value", () => {
    expect(check({ ...good, "x-codelogs-extension": "other" })).toBe(false);
  });
  it("rejects a missing origin", () => {
    expect(check({ "x-codelogs-extension": "connect" })).toBe(false);
  });
  it("rejects a cross-site origin", () => {
    expect(check({ ...good, origin: "https://evil.example" })).toBe(false);
  });
});
