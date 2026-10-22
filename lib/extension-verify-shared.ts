// The login-match check for Codeforces and AtCoder (POST /api/extension/verify): the extension
// reads which user the browser is logged in as and the server compares it with the connected
// handle. Pure, so tests and the route share one definition (PLAN-v2.md §9 "Verification").

import { z } from "zod";
import { PLATFORM_META } from "@/lib/platforms";

/** The server syncs these from public APIs; the extension only verifies them. */
export const EXTENSION_VERIFY_PLATFORMS = ["codeforces", "atcoder"] as const;
export type ExtensionVerifyPlatform = (typeof EXTENSION_VERIFY_PLATFORMS)[number];

export const extensionVerifySchema = z.object({
  platform: z.enum(EXTENSION_VERIFY_PLATFORMS),
  loggedInAs: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]{1,64}$/),
});

export type ExtensionVerifyBody = z.infer<typeof extensionVerifySchema>;

export type VerifyDecision =
  | { kind: "verify"; handle: string }
  | { kind: "already"; handle: string }
  | { kind: "error"; status: 404 | 409; error: string };

/**
 * Both platforms treat handles case-insensitively, so the comparison does too. The stored handle
 * (canonical from the platform's API) is kept as is.
 */
export function decideVerify(
  account: { handle: string; verified: boolean } | null,
  body: ExtensionVerifyBody,
): VerifyDecision {
  const name = PLATFORM_META[body.platform].name;
  if (!account) {
    return {
      kind: "error",
      status: 404,
      error: `Add your ${name} handle on the CodeLogs Connect page first.`,
    };
  }
  if (account.handle.toLowerCase() !== body.loggedInAs.toLowerCase()) {
    return {
      kind: "error",
      status: 409,
      error: `This browser is logged in to ${name} as ${body.loggedInAs}, but your connected ${name} handle is ${account.handle}.`,
    };
  }
  return account.verified
    ? { kind: "already", handle: account.handle }
    : { kind: "verify", handle: account.handle };
}
