"use server";

import { refresh } from "next/cache";
import { revokeApiToken } from "@/lib/api-tokens";
import { getCurrentUser } from "@/lib/session";

/** Revokes one of the signed-in user's tokens. */
export async function revokeExtensionToken(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof id !== "string") return { ok: false };
  const ok = await revokeApiToken(user.id, id).catch(() => false);
  if (ok) refresh();
  return { ok };
}
