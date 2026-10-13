"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDeleteConfirmed } from "@/lib/account-export-shared";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";

export type DeleteAccountState = { ok: false; error: string } | null;

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You are signed out. Sign in again to continue." };

  const confirmation = formData.get("confirmation");
  if (typeof confirmation !== "string" || !isDeleteConfirmed(user.username, confirmation)) {
    return { ok: false, error: "The confirmation text does not match." };
  }

  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // The session rows are deleted with the user anyway.
  }

  try {
    // Sessions, OAuth links, platform accounts and everything under them cascade from users.id.
    await db.delete(users).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Could not delete your account. Please try again." };
  }

  redirect("/");
}
