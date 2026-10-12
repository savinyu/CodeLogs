import { Suspense } from "react";
import Link from "next/link";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

async function HeroCta() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
        Go to dashboard
      </Link>
    );
  }
  return <SignInButton size="lg" />;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">CodeLogs</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Track Codeforces, AtCoder and LeetCode in one dashboard. See your progress over time, find
        the topics you are weakest at, and get a suggestion for what to solve next.
      </p>
      <Suspense fallback={<Skeleton className="h-9 w-44 rounded-lg" />}>
        <HeroCta />
      </Suspense>
    </main>
  );
}
