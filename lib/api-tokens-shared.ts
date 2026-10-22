// Personal API tokens for the browser extension: format, hashing and the request contract.
// Pure (node:crypto only), so tests and the route share one definition.

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/** "cl_" + 43 base64url characters (32 random bytes). */
export const TOKEN_PATTERN = /^cl_[A-Za-z0-9_-]{43}$/;
export const TOKEN_PREFIX_LENGTH = 9;
export const MAX_TOKENS_PER_USER = 5;
export const TOKEN_NAME_MAX = 60;
/** The name of the token the extension gets when it connects itself. */
export const EXTENSION_TOKEN_NAME = "Browser extension";

export function generateToken(): string {
  return `cl_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenPrefix(token: string): string {
  return token.slice(0, TOKEN_PREFIX_LENGTH);
}

/** The token from an `Authorization: Bearer cl_…` header, or null if missing or malformed. */
export function parseBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  const token = match?.[1];
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

/** A token name from a form field: trimmed, "Browser extension" when empty, null when too long. */
export function parseTokenName(raw: unknown): string | null {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (name.length > TOKEN_NAME_MAX) return null;
  return name || EXTENSION_TOKEN_NAME;
}

/**
 * CSRF guard for POST /api/extension/connect: the custom header forces a CORS preflight (which
 * the route never answers), and the Origin must be this site's own page.
 */
export function isExtensionConnectRequest(headers: Headers, requestUrl: string): boolean {
  if (headers.get("x-logn-extension") !== "connect") return false;
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/** Largest request body the extension endpoint accepts. 5,000 slugs with dates is ~400 KB. */
export const MAX_EXTENSION_BODY_BYTES = 1_000_000;

/**
 * POST /api/extension/leetcode body. `userName` is the logged-in leetcode.com user (from
 * api/problems/all/), checked against the connected handle. `solvedAt` is the earliest accepted
 * submission in epoch seconds, or null when the extension couldn't read dates.
 */
export const extensionLeetcodeSchema = z.object({
  userName: z.string().trim().min(1).max(200),
  solves: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
        solvedAt: z.number().int().positive().max(4_102_444_800).nullable(),
      }),
    )
    .min(1)
    .max(5000),
  /** The user clicked LeetCode in the extension; only then is a removed handle connected. */
  manual: z.boolean().optional(),
});

export type ExtensionLeetcodeBody = z.infer<typeof extensionLeetcodeSchema>;
