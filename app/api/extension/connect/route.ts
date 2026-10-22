import { connectExtensionToken } from "@/lib/api-tokens";
import { isExtensionConnectRequest } from "@/lib/api-tokens-shared";
import { auth } from "@/lib/auth";

// Called by the extension from inside the /extension/connect tab. Same-origin fetch with a
// custom header (forces a preflight we never answer) and an Origin check guard against CSRF.
// The session is read with auth.api.getSession directly: getCurrentUser() is a "use cache:
// private" function meant for rendering, and a route handler should always read the live request.
export async function POST(request: Request) {
  if (!isExtensionConnectRequest(request.headers, request.url)) {
    return respond({ ok: false, error: "Forbidden." }, 403);
  }
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return respond({ ok: false, error: "Sign in to LogN first." }, 401);
    const result = await connectExtensionToken(session.user.id);
    if (!result.ok) return respond({ ok: false, error: result.error }, 409);
    return respond({
      ok: true,
      token: result.token,
      username: session.user.username ?? null,
    });
  } catch {
    return respond({ ok: false, error: "Could not connect. Please try again." }, 500);
  }
}

function respond(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
