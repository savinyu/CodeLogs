import type { LeetcodeBadge } from "@/lib/dashboard/types";

function earnedLabel(day: string | null): string | null {
  if (!day) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function LeetcodeBadges({ badges }: { badges: LeetcodeBadge[] }) {
  return (
    <ul className="flex flex-wrap gap-4">
      {badges.map((b) => {
        const earned = earnedLabel(b.earnedAt);
        return (
          <li
            key={b.id}
            title={earned ? `${b.name} · ${earned}` : b.name}
            className="flex w-24 flex-col items-center gap-1 text-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- remote LeetCode icons, no optimizer needed */}
            <img
              src={b.icon}
              alt={b.name}
              width={48}
              height={48}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-12 object-contain"
            />
            <span className="line-clamp-2 text-xs font-medium">{b.name}</span>
            {earned && <span className="text-xs text-muted-foreground">{earned}</span>}
          </li>
        );
      })}
    </ul>
  );
}
