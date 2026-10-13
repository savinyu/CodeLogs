"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { addPlatformAccount, removePlatformAccount } from "@/lib/accounts";
import { validateHandle } from "@/lib/adapters/validate";
import { PLATFORMS } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { requestSync } from "@/lib/sync/request";

/** On error, `handle` echoes what the user typed so the form can keep it (React resets forms after an action). */
export type ActionState = { ok: true } | { ok: false; error: string; handle?: string } | null;

const platformSchema = z.enum(PLATFORMS);
const connectSchema = z.object({
  platform: platformSchema,
  handle: z.string().min(1, "Enter your handle.").max(200, "That handle is too long."),
});
const disconnectSchema = z.object({ platform: platformSchema });
const syncSchema = z.object({ platform: platformSchema.optional() });

/** `queued` is how many accounts were sent to the sync queue; 0 means all were synced recently. */
export type SyncState = { ok: true; queued: number } | { ok: false; error: string } | null;

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

  const validation = await validateHandle(platform, handle);
  if (validation.result !== "valid") return { ok: false, error: validation.message, handle };

  const result = await addPlatformAccount(user.id, platform, validation.canonicalHandle);
  if (!result.ok) return { ...result, handle };

  // Best effort: sync the new handle right away, but never fail the connect because of it.
  try {
    await requestSync(user.id, { platforms: [platform], ignoreCooldown: true });
  } catch (err) {
    console.error("Could not queue the first sync", err);
  }

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

export async function syncNow(_prevState: SyncState, formData: FormData): Promise<SyncState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to sync your platforms." };

  // An empty or missing platform field means every connected account. A missing field is
  // `null` from FormData, which zod's `.optional()` rejects, so map both to undefined.
  const rawPlatform = formData.get("platform");
  const parsed = syncSchema.safeParse({ platform: rawPlatform || undefined });
  if (!parsed.success) return { ok: false, error: "Unknown platform." };
  const { platform } = parsed.data;

  try {
    const result = await requestSync(user.id, platform ? { platforms: [platform] } : {});
    refresh();
    return result;
  } catch (err) {
    console.error("Could not request a sync", err);
    return { ok: false, error: "Couldn't start the sync. Try again in a moment." };
  }
}
