import { Suspense } from "react";
import Link from "next/link";
import { HeaderStreak } from "@/components/shell/header-streak";
import { MainNav } from "@/components/shell/main-nav";
import { ProfileMenu } from "@/components/shell/profile-menu";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

/** The pill nav for signed-in users; on /u/... the profile URL pill, for visitors too. */
async function HeaderNav({ host }: { host: string }) {
  const user = await getCurrentUser();
  return <MainNav signedIn={user !== null} host={host} />;
}

export function SiteHeader() {
  const host = new URL(env().BETTER_AUTH_URL).host;
  return (
    <header className="sticky top-0 z-20 bg-background">
      <div className="mx-auto flex w-full max-w-[70rem] flex-wrap items-center gap-3 px-4 py-3 max-[760px]:gap-y-2">
        <Link
          href="/"
          aria-label="CodeLogs home"
          className="flex items-center gap-2.5 rounded-full font-display text-xl font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            aria-hidden="true"
            className="grid size-[30px] place-items-center rounded-[10px] bg-primary text-primary-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                d="M6 4 2 9l4 5M12 4l4 5-4 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          CodeLogs
        </Link>
        <div className="flex flex-1 justify-center max-[760px]:order-5 max-[760px]:flex-[0_0_100%] max-[760px]:justify-start max-[760px]:overflow-x-auto max-[760px]:[scrollbar-width:none] max-[760px]:empty:hidden max-[760px]:[&::-webkit-scrollbar]:hidden">
          <Suspense fallback={null}>
            <HeaderNav host={host} />
          </Suspense>
        </div>
        <div className="flex items-center gap-2.5 max-[760px]:ml-auto">
          <ThemeToggle />
          <Suspense fallback={null}>
            <HeaderStreak />
          </Suspense>
          <Suspense fallback={<Skeleton className="size-10 rounded-full" />}>
            <ProfileMenu host={host} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
