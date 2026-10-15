/**
 * Social links on a profile: parsing and URLs. Pure, so client forms and tests can use it.
 * Known networks store a handle and we build the URL, so a link under the Instagram icon
 * always goes to Instagram. GitHub isn't stored: it's the login, shown from users.username.
 */

export const SOCIAL_KINDS = ["x", "instagram", "website", "email"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];
export type SocialLinks = Partial<Record<SocialKind, string>>;

type ParseResult = { ok: true; value: string | null } | { ok: false; error: string };

const MAX_LENGTH = 200;

/** A bare handle, "@handle", or a profile URL whose host matches `host` (a regex source). */
function parseHandle(raw: string, host: string, pattern: RegExp, error: string): ParseResult {
  const fromUrl = raw.match(new RegExp(`^(?:https?://)?(?:www\\.)?${host}/([^/?#]+)`, "i"));
  const handle = (fromUrl?.[1] ?? raw).replace(/^@/, "");
  return pattern.test(handle) ? { ok: true, value: handle } : { ok: false, error };
}

const PARSERS: Record<SocialKind, (raw: string) => ParseResult> = {
  x: (raw) =>
    parseHandle(
      raw,
      "(?:x|twitter)\\.com",
      /^[A-Za-z0-9_]{1,15}$/,
      "Use your X handle: up to 15 letters, digits or underscores.",
    ),
  // Instagram usernames are case-insensitive; store them lowercase.
  instagram: (raw) =>
    parseHandle(
      raw.toLowerCase(),
      "instagram\\.com",
      /^[a-z0-9._]{1,30}$/,
      "Use your Instagram username: up to 30 letters, digits, periods or underscores.",
    ),
  website: (raw) => {
    const error = "Use a full https:// address, like https://example.com.";
    let url: URL;
    try {
      url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    } catch {
      return { ok: false, error };
    }
    const valid =
      url.protocol === "https:" &&
      url.hostname.includes(".") &&
      !url.username &&
      !url.password &&
      url.href.length <= MAX_LENGTH;
    return valid ? { ok: true, value: url.href } : { ok: false, error };
  },
  email: (raw) =>
    /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(raw) && raw.length <= MAX_LENGTH
      ? { ok: true, value: raw }
      : { ok: false, error: "Use an email address, like you@example.com." },
};

/** Trims and validates one field. Empty input means "remove the link" (value null). */
export function parseSocialLink(kind: SocialKind, input: unknown): ParseResult {
  const raw = typeof input === "string" ? input.trim() : "";
  return raw ? PARSERS[kind](raw) : { ok: true, value: null };
}

export function socialLinkHref(kind: SocialKind | "github", value: string): string {
  switch (kind) {
    case "github":
      return `https://github.com/${value}`;
    case "x":
      return `https://x.com/${value}`;
    case "instagram":
      return `https://www.instagram.com/${value}/`;
    case "website":
      return value;
    case "email":
      return `mailto:${value}`;
  }
}

/** Short text for a link: "@handle", the bare host and path of a website, or the address. */
export function socialLinkLabel(kind: SocialKind | "github", value: string): string {
  if (kind === "website") return value.replace(/^https:\/\//, "").replace(/\/$/, "");
  if (kind === "email") return value;
  return `@${value}`;
}
