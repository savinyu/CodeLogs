import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** The narrow user shape pages and components may see. */
export type CurrentUser = {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
};

/**
 * Reads the session from the request. With cacheComponents on, any component that
 * calls this must render inside a <Suspense> boundary (it reads headers()).
 * Deduped per request by React cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, image } = session.user;
  return { id, name, image: image ?? null, username: session.user.username ?? null };
});

/** Like getCurrentUser, but redirects signed-out visitors to the landing page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}
