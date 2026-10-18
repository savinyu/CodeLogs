import { authenticateBearer } from "@/lib/api-tokens";
import { ingestExtensionUpload } from "@/lib/extension-platform-ingest";
import { extensionUploadSchema, MAX_PLATFORM_UPLOAD_BYTES } from "@/lib/extension-upload";

// The browser extension uploads what it read from CodeChef, Code360, HackerRank, InterviewBit
// or GFG while the user is logged in there. Authenticated by a personal token from Settings.
export async function POST(request: Request) {
  const user = await authenticateBearer(request.headers.get("authorization"));
  if (!user) {
    return error(401, "Invalid or revoked token. Create a new one in CodeLogs Settings.");
  }

  const text = await request.text();
  if (text.length > MAX_PLATFORM_UPLOAD_BYTES)
    return error(413, "Too many problems in one upload.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return error(400, "The request body isn't JSON.");
  }
  const parsed = extensionUploadSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return error(
      400,
      `Invalid upload${issue ? ` at ${issue.path.join(".")}: ${issue.message}` : ""}.`,
    );
  }

  const result = await ingestExtensionUpload(user.userId, parsed.data);
  if (!result.ok) return error(result.status, result.error);
  return Response.json(result, { headers: noStore });
}

function error(status: number, message: string) {
  return Response.json({ ok: false, error: message }, { status, headers: noStore });
}

const noStore = { "Cache-Control": "no-store" };
