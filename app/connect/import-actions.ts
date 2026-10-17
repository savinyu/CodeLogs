"use server";

import { z } from "zod";
import { userDataChanged } from "@/lib/cache";
import { ingestLeetcodeSolves } from "@/lib/leetcode-ingest";
import { getCurrentUser } from "@/lib/session";

export type ImportResult =
  | {
      ok: true;
      imported: number;
      alreadyKnown: number;
      skipped: number;
      complete: boolean;
      known: number;
      lifetime: number | null;
    }
  | { ok: false; error: string };

const importSchema = z.object({
  userName: z.string().max(200),
  slugs: z
    .array(z.string().regex(/^[a-z0-9-]{1,120}$/, "The file has an unexpected problem name."))
    .min(1, "The file has no solved problems.")
    .max(5000, "The file has too many solved problems."),
  numSolved: z.number().int().nonnegative().nullable(),
});

export async function importLeetcodeSolves(input: unknown): Promise<ImportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to import your history." };

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid import." };
  }
  const { userName, slugs, numSolved } = parsed.data;

  const result = await ingestLeetcodeSolves(
    user.id,
    { userName, numSolved, solves: slugs.map((slug) => ({ slug, solvedAt: null })) },
    "import",
  );
  if (!result.ok) return { ok: false, error: result.error };
  userDataChanged(user.id);
  const { imported, alreadyKnown, skipped, complete, known, lifetime } = result;
  return { ok: true, imported, alreadyKnown, skipped, complete, known, lifetime };
}
