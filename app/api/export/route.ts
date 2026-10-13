import { buildAccountExport } from "@/lib/account-export";
import { exportFilename } from "@/lib/account-export-shared";
import { getCurrentUser } from "@/lib/session";

// Reads the session (headers), so with Cache Components this GET is dynamic at request time.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401, headers: noStore });
  }
  const data = await buildAccountExport(user.id);
  if (!data) {
    return Response.json({ error: "Account not found" }, { status: 404, headers: noStore });
  }
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(user.username, user.id, data.exportedAt)}"`,
      "Cache-Control": "no-store",
    },
  });
}

const noStore = { "Cache-Control": "no-store" };
