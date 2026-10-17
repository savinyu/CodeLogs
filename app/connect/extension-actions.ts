"use server";

import { refresh } from "next/cache";
import { createApiToken, revokeApiToken } from "@/lib/api-tokens";
import { parseTokenName, TOKEN_NAME_MAX } from "@/lib/api-tokens-shared";
import { getCurrentUser } from "@/lib/session";

export type CreateTokenState =
  { ok: true; token: string; name: string } | { ok: false; error: string } | null;

/** Creates an extension token. The full token is returned once, to be shown and copied. */
export async function createExtensionToken(
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are signed out. Sign in again to continue." };
  const name = parseTokenName(formData.get("name"));
  if (!name) return { ok: false, error: `Use at most ${TOKEN_NAME_MAX} characters.` };
  try {
    const result = await createApiToken(user.id, name);
    if (!result.ok) return result;
    refresh();
    return { ok: true, token: result.token, name };
  } catch {
    return { ok: false, error: "Could not create a token. Please try again." };
  }
}

/** Revokes one of the signed-in user's tokens. */
export async function revokeExtensionToken(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof id !== "string") return { ok: false };
  const ok = await revokeApiToken(user.id, id).catch(() => false);
  if (ok) refresh();
  return { ok };
}
