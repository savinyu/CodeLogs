import Link from "next/link";
import { Flame } from "@/components/kit/flame";
import { HideOnPublic } from "@/components/shell/hide-on-public";
import { getCurrentUser } from "@/lib/session";
import { getHeaderStreak } from "@/lib/streak";
import { cn } from "cn";

/** The streak pill. Reads the session, so it must render inside <Suspense>. */
export async function HeaderStreak() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { days, litToday } = await getHeaderStreak(user.id);
  const label = `Current streak: ${days} ${days === 1 ? "day" : "days"}${
    litToday ? "" : " (no solve yet today)"
  }`;

  return (
    <HideOnPublic>
      <Link
        href="/progress"
        aria-label={`${label}. Open Progress.`}
        title={label}
        className={cn(
          "inline-flex h-10 items-center gap-1 rounded-full bg-card pr-3 pl-[9px] text-[0.9375rem] font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-[760px]:pr-2.5 max-[760px]:pl-[7px]",
          !litToday && "text-muted-foreground",
        )}
      >
        <Flame size={22} lit={litToday} />
        <span>{days}</span>
      </Link>
    </HideOnPublic>
  );
}
