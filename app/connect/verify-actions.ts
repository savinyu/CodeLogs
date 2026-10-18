"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { PlatformUserNotFoundError } from "@/lib/adapters/errors";
import { ADAPTERS } from "@/lib/adapters/index";
import { userDataChanged } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { platformAccounts, SYNCED_PLATFORMS } from "@/lib/db/schema";
import { PLATFORM_META } from "@/lib/platforms";
import { getCurrentUser } from "@/lib/session";
import { fieldContainsToken, makeVerifyToken, VERIFY_FIELD } from "@/lib/verification";

export type VerifyState = { ok: true } | { ok: false; error: string } | null;

// Bio-code verification is for server-synced platforms; extension platforms verify on upload.
const schema = z.object({ platform: z.enum(SYNCED_PLATFORMS) });

function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function startVerification(
  _prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to verify a handle." };

  const parsed = schema.safeParse({ platform: formData.get("platform") });
  if (!parsed.success) return { ok: false, error: "Unknown platform." };
  const { platform } = parsed.data;

  try {
    const [account] = await db
      .select({ verified: platformAccounts.verified, verifyToken: platformAccounts.verifyToken })
      .from(platformAccounts)
      .where(and(eq(platformAccounts.userId, user.id), eq(platformAccounts.platform, platform)))
      .limit(1);
    if (!account) return { ok: false, error: "Connect that handle first." };
    if (account.verified) return { ok: true };

    if (!account.verifyToken) {
      await db
        .update(platformAccounts)
        .set({ verifyToken: makeVerifyToken() })
        .where(and(eq(platformAccounts.userId, user.id), eq(platformAccounts.platform, platform)));
    }
  } catch (err) {
    console.error("Could not start verification", err);
    return { ok: false, error: "Couldn't generate a code. Try again in a moment." };
  }

  userDataChanged(user.id);
  return { ok: true };
}

export async function checkVerification(
  _prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to verify a handle." };

  const parsed = schema.safeParse({ platform: formData.get("platform") });
  if (!parsed.success) return { ok: false, error: "Unknown platform." };
  const { platform } = parsed.data;
  const name = PLATFORM_META[platform].name;
  const label = VERIFY_FIELD[platform].label.toLowerCase();

  const [account] = await db
    .select({
      handle: platformAccounts.handle,
      verified: platformAccounts.verified,
      verifyToken: platformAccounts.verifyToken,
    })
    .from(platformAccounts)
    .where(and(eq(platformAccounts.userId, user.id), eq(platformAccounts.platform, platform)))
    .limit(1);
  if (!account) return { ok: false, error: "Connect that handle first." };
  if (account.verified) return { ok: true };
  const token = account.verifyToken;
  if (!token) return { ok: false, error: "Get a code first." };

  let field: string | null;
  try {
    field = await ADAPTERS[platform].readVerificationField(account.handle);
  } catch (err) {
    if (err instanceof PlatformUserNotFoundError) {
      return { ok: false, error: `We couldn't find that handle on ${name} anymore.` };
    }
    console.error(`Could not read the ${name} verification field`, err);
    return { ok: false, error: `Couldn't reach ${name}. Try again in a moment.` };
  }

  if (!fieldContainsToken(field, token)) {
    const seen = field ? `is "${truncate(field)}", which doesn't` : "is empty, so it doesn't";
    return {
      ok: false,
      error: `Your ${name} ${label} ${seen} contain ${token} yet. Changes can take a minute to show.`,
    };
  }

  try {
    await db
      .update(platformAccounts)
      .set({ verified: true, verifyToken: null })
      // Matching the token too, so a handle replaced mid-check can't inherit the result.
      .where(
        and(
          eq(platformAccounts.userId, user.id),
          eq(platformAccounts.platform, platform),
          eq(platformAccounts.verifyToken, token),
        ),
      );
  } catch (err) {
    console.error("Could not mark the account verified", err);
    return { ok: false, error: "Couldn't save the result. Try again in a moment." };
  }

  userDataChanged(user.id);
  return { ok: true };
}
