"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { addPlatformAccount, removePlatformAccount } from "@/lib/accounts";
import { validateHandleStub } from "@/lib/adapters/validate-stub";
import { PLATFORMS } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";

/** On error, `handle` echoes what the user typed so the form can keep it (React resets forms after an action). */
export type ActionState = { ok: true } | { ok: false; error: string; handle?: string } | null;

const platformSchema = z.enum(PLATFORMS);
const connectSchema = z.object({
  platform: platformSchema,
  handle: z.string().min(1, "Enter your handle.").max(200, "That handle is too long."),
});
const disconnectSchema = z.object({ platform: platformSchema });

export async function connectPlatform(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to connect a platform." };

  const rawHandle = formData.get("handle");
  const typed = typeof rawHandle === "string" ? rawHandle.slice(0, 200) : undefined;
  const parsed = connectSchema.safeParse({ platform: formData.get("platform"), handle: rawHandle });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", handle: typed };
  }
  const { platform, handle } = parsed.data;

  const validation = await validateHandleStub(platform, handle);
  if (validation.result !== "valid") return { ok: false, error: validation.message, handle };

  const result = await addPlatformAccount(user.id, platform, validation.canonicalHandle);
  if (!result.ok) return { ...result, handle };

  refresh();
  return { ok: true };
}

export async function disconnectPlatform(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to manage your platforms." };

  const parsed = disconnectSchema.safeParse({ platform: formData.get("platform") });
  if (!parsed.success) return { ok: false, error: "Unknown platform." };

  const result = await removePlatformAccount(user.id, parsed.data.platform);
  if (!result.ok) return result;

  refresh();
  return { ok: true };
}
