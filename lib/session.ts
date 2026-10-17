import "server-only";
import { cacheLife } from "next/cache";
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
 * A private cache: deduped per request, never stored on the server. Its lifetime lets link
 * prefetches carry the signed-in page, so a first visit to a page needs no skeleton either.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  "use cache: private";
  cacheLife("user");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, image } = session.user;
  return { id, name, image: image ?? null, username: session.user.username ?? null };
}

/** Like getCurrentUser, but redirects signed-out visitors to the landing page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}
