import { ImageResponse } from "next/og";
import { getDashboardData, getPublicProfile } from "@/lib/dashboard/queries";
import { PLATFORM_META } from "@/lib/platforms";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CodeLogs profile";

// Fixed colors: the image is rendered once for social previews, outside any theme.
const PLATFORM_HEX = { codeforces: "#3b82f6", atcoder: "#14b8a6", leetcode: "#f59e0b" } as const;

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  const data = profile ? await getDashboardData(profile.userId) : null;
  const total = data?.totals.reduce((sum, t) => sum + t.solved, 0) ?? 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 32, color: "#a3a3a3" }}>CodeLogs</div>
      {profile && data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>{profile.name}</div>
          <div style={{ display: "flex", fontSize: 40, color: "#d4d4d4" }}>
            {`${total.toLocaleString("en-US")} problems solved`}
          </div>
          <div style={{ display: "flex", gap: 48, marginTop: 16 }}>
            {data.totals.map((t) => (
              <div key={t.platform} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    background: PLATFORM_HEX[t.platform],
                  }}
                />
                <div style={{ display: "flex", fontSize: 32 }}>
                  {`${PLATFORM_META[t.platform].name} ${t.solved}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 56 }}>Profile not found</div>
      )}
      <div style={{ display: "flex", fontSize: 28, color: "#737373" }}>{`/u/${username}`}</div>
    </div>,
    size,
  );
}
