import { Suspense } from "react";
import Link from "next/link";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PublicProfileToggle } from "@/components/dashboard/public-profile-toggle";
import { SheetsSummary } from "@/components/dashboard/sheets-card";
import { SolveNext, SolveNextSkeleton } from "@/components/dashboard/solve-next";
import { SocialLinksRow } from "@/components/social-links";
import { Skeleton } from "@/components/ui/skeleton";
import { parsePlatformFilter } from "@/lib/dashboard/aggregate";
import { getDashboardData, getPublicProfileSetting } from "@/lib/dashboard/queries";
import { requireUser } from "@/lib/session";
import { getSocialLinks } from "@/lib/social-links";

async function DashboardContent({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  const [data, isPublic, links, params] = await Promise.all([
    getDashboardData(user.id),
    getPublicProfileSetting(user.id),
    getSocialLinks(user.id),
    searchParams,
  ]);
  const filter = parsePlatformFilter(params.platform);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <SocialLinksRow github={user.username} links={links} />
            <Link
              href="/settings#social-links"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {Object.keys(links).length > 0 ? "Edit links" : "Add social links"}
            </Link>
          </div>
        </div>
        {user.username && (
          <PublicProfileToggle
            username={user.username}
            enabled={isPublic}
            unverified={data.accounts.filter((a) => !a.verified).length}
          />
        )}
      </div>
      <DashboardView
        data={data}
        filter={filter}
        year={params.year}
        isOwner
        solveNext={
          <Suspense fallback={<SolveNextSkeleton />}>
            <SolveNext userId={user.id} data={data} filter={filter} />
          </Suspense>
        }
        sheets={
          filter === "all" || filter === "leetcode" ? (
            <Suspense fallback={<Skeleton className="h-24 w-full" />}>
              <SheetsSummary userId={user.id} />
            </Suspense>
          ) : undefined
        }
      />
    </>
  );
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={
          <>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </>
        }
      >
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
