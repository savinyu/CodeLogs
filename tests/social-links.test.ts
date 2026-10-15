import { describe, expect, it } from "vitest";
import { parseSocialLink, socialLinkHref, socialLinkLabel } from "@/lib/social-links-shared";

const ok = (value: string | null) => ({ ok: true, value });

describe("parseSocialLink", () => {
  it("treats empty or missing input as removing the link", () => {
    expect(parseSocialLink("x", "")).toEqual(ok(null));
    expect(parseSocialLink("email", "   ")).toEqual(ok(null));
    expect(parseSocialLink("website", null)).toEqual(ok(null));
  });

  it("reads an X handle from a bare handle, @handle or a profile URL", () => {
    expect(parseSocialLink("x", "savinyu")).toEqual(ok("savinyu"));
    expect(parseSocialLink("x", " @Sav_1 ")).toEqual(ok("Sav_1"));
    expect(parseSocialLink("x", "https://x.com/savinyu?s=21")).toEqual(ok("savinyu"));
    expect(parseSocialLink("x", "twitter.com/savinyu/")).toEqual(ok("savinyu"));
    expect(parseSocialLink("x", "www.twitter.com/savinyu")).toEqual(ok("savinyu"));
  });

  it("rejects malformed X handles and other sites", () => {
    expect(parseSocialLink("x", "has space").ok).toBe(false);
    expect(parseSocialLink("x", "sixteen_chars_xx").ok).toBe(false);
    expect(parseSocialLink("x", "https://evil.com/savinyu").ok).toBe(false);
  });

  it("lowercases Instagram usernames and allows periods", () => {
    expect(parseSocialLink("instagram", "Sav.Inyu_")).toEqual(ok("sav.inyu_"));
    expect(parseSocialLink("instagram", "https://www.instagram.com/sav.inyu/")).toEqual(
      ok("sav.inyu"),
    );
    expect(parseSocialLink("instagram", "no-dashes").ok).toBe(false);
  });

  it("accepts https websites and adds https:// to bare domains", () => {
    expect(parseSocialLink("website", "https://example.com/blog")).toEqual(
      ok("https://example.com/blog"),
    );
    expect(parseSocialLink("website", "example.com")).toEqual(ok("https://example.com/"));
  });

  it("rejects http, javascript:, credentials and hosts without a dot", () => {
    for (const input of [
      "http://example.com",
      "javascript:alert(1)",
      "javascript://example.com/%0Aalert(1)",
      "https://user:pass@example.com",
      "https://localhost",
      "data:text/html,hi",
    ]) {
      expect(parseSocialLink("website", input).ok, input).toBe(false);
    }
  });

  it("accepts plain email addresses only", () => {
    expect(parseSocialLink("email", "me+cf@example.co.in")).toEqual(ok("me+cf@example.co.in"));
    expect(parseSocialLink("email", "not-an-email").ok).toBe(false);
    expect(parseSocialLink("email", "a@b.com?subject=hi").ok).toBe(false);
  });
});

describe("socialLinkHref and socialLinkLabel", () => {
  it("builds each network's URL from the stored value", () => {
    expect(socialLinkHref("github", "savinyu")).toBe("https://github.com/savinyu");
    expect(socialLinkHref("x", "savinyu")).toBe("https://x.com/savinyu");
    expect(socialLinkHref("instagram", "sav")).toBe("https://www.instagram.com/sav/");
    expect(socialLinkHref("website", "https://example.com/")).toBe("https://example.com/");
    expect(socialLinkHref("email", "me@example.com")).toBe("mailto:me@example.com");
  });

  it("shows @handles, bare websites and addresses", () => {
    expect(socialLinkLabel("x", "savinyu")).toBe("@savinyu");
    expect(socialLinkLabel("website", "https://example.com/")).toBe("example.com");
    expect(socialLinkLabel("website", "https://example.com/blog")).toBe("example.com/blog");
    expect(socialLinkLabel("email", "me@example.com")).toBe("me@example.com");
  });
});
