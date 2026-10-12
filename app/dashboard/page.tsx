import { Suspense } from "react";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";

async function DashboardContent() {
  const user = await requireUser();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
      <Link
        href="/connect"
        className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle>Connect your platforms</CardTitle>
            <CardDescription>
              Add your Codeforces, AtCoder and LeetCode handles to start tracking.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <p className="text-sm text-muted-foreground">
        Charts and insights are coming in a later milestone.
      </p>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={
          <>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </>
        }
      >
        <DashboardContent />
      </Suspense>
    </main>
  );
}
