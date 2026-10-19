import { authenticateBearer } from "@/lib/api-tokens";
import { extensionLeetcodeSchema, MAX_EXTENSION_BODY_BYTES } from "@/lib/api-tokens-shared";
import { ingestLeetcodeSolves } from "@/lib/leetcode-ingest";

// The browser extension uploads the user's full LeetCode solved list (with dates when it could
// read them). Authenticated by the token the extension got when it connected, never by cookies.
export async function POST(request: Request) {
  const user = await authenticateBearer(request.headers.get("authorization"));
  if (!user) {
    return error(401, "Invalid or revoked token. Connect the extension again from its popup.");
  }

  const text = await request.text();
  if (text.length > MAX_EXTENSION_BODY_BYTES) return error(413, "Too many problems in one upload.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return error(400, "The request body isn't JSON.");
  }
  const parsed = extensionLeetcodeSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return error(
      400,
      `Invalid upload${issue ? ` at ${issue.path.join(".")}: ${issue.message}` : ""}.`,
    );
  }

  const result = await ingestLeetcodeSolves(user.userId, parsed.data, "extension");
  if (!result.ok) return error(result.status, result.error);
  return Response.json(result, { headers: noStore });
}

function error(status: number, message: string) {
  return Response.json({ ok: false, error: message }, { status, headers: noStore });
}

const noStore = { "Cache-Control": "no-store" };
