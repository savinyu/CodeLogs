import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { socialLinks } from "@/lib/db/schema";
import type { SocialLinks } from "@/lib/social-links-shared";

export async function getSocialLinks(userId: string): Promise<SocialLinks> {
  const rows = await db
    .select({ kind: socialLinks.kind, value: socialLinks.value })
    .from(socialLinks)
    .where(eq(socialLinks.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.kind, r.value]));
}
