import { Suspense } from "react";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

/** Nav links are only useful once signed in, so they stream in behind Suspense. */
async function SiteNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <nav className="flex items-center gap-1">
      <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
        Dashboard
      </Link>
      <Link href="/connect" className={buttonVariants({ variant: "ghost" })}>
        Connect
      </Link>
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold tracking-tight">
            CodeLogs
          </Link>
          <Suspense fallback={null}>
            <SiteNav />
          </Suspense>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Suspense fallback={<Skeleton className="h-8 w-24 rounded-lg" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
