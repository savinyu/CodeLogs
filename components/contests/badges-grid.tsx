import type { LeetcodeBadge } from "@/lib/dashboard/types";

function earnedLabel(day: string | null): string | null {
  if (!day) return null;
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** LeetCode's real badge icons in a tile grid (Coach's .badges). */
export function LeetcodeBadgesGrid({ badges }: { badges: LeetcodeBadge[] }) {
  return (
    <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(170px,100%),1fr))] gap-3.5">
      {badges.map((b) => {
        const earned = earnedLabel(b.earnedAt);
        return (
          <li
            key={b.id}
            className="grid justify-items-center gap-2 rounded-item bg-raised px-3.5 py-4.5 text-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- remote LeetCode icons, no optimizer needed */}
            <img
              src={b.icon}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-16 object-contain"
            />
            <b className="text-[0.9375rem] leading-[1.3] font-semibold">{b.name}</b>
            {earned && <span className="text-[0.84rem] text-muted-foreground">{earned}</span>}
          </li>
        );
      })}
    </ul>
  );
}
