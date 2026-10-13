import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { parsePlatformFilter } from "@/lib/dashboard/aggregate";
import { getDashboardData, getPublicProfile } from "@/lib/dashboard/queries";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: "Profile not found · CodeLogs" };
  return {
    title: `${profile.name} (@${profile.username}) · CodeLogs`,
    description: `${profile.name}'s solved problems across Codeforces, AtCoder and LeetCode.`,
  };
}

async function PublicProfileContent({ params, searchParams }: PageProps<"/u/[username]">) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  // Private and unknown profiles look the same from outside.
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const data = await getDashboardData(profile.userId);

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar className="size-12">
          {profile.image ? <AvatarImage src={profile.image} alt="" /> : null}
          <AvatarFallback>{profile.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
        </div>
      </div>
      <DashboardView
        data={data}
        filter={parsePlatformFilter(query.platform)}
        year={query.year}
        isOwner={false}
      />
    </>
  );
}

export default function PublicProfilePage(props: PageProps<"/u/[username]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={
          <>
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </>
        }
      >
        <PublicProfileContent {...props} />
      </Suspense>
    </main>
  );
}
