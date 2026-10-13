import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PublicProfileToggle } from "@/components/dashboard/public-profile-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { parsePlatformFilter } from "@/lib/dashboard/aggregate";
import { getDashboardData, getPublicProfileSetting } from "@/lib/dashboard/queries";
import { requireUser } from "@/lib/session";

async function DashboardContent({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  const [data, isPublic, params] = await Promise.all([
    getDashboardData(user.id),
    getPublicProfileSetting(user.id),
    searchParams,
  ]);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
        {user.username && <PublicProfileToggle username={user.username} enabled={isPublic} />}
      </div>
      <DashboardView data={data} filter={parsePlatformFilter(params.platform)} isOwner />
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
