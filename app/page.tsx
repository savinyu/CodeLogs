import { Suspense } from "react";
import Link from "next/link";
import { SignInButtons } from "@/components/auth/sign-in-buttons";
import { Chip } from "@/components/kit/chip";
import { Page } from "@/components/kit/page";
import { Panel } from "@/components/kit/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

const FEATURES = [
  {
    chip: "Daily",
    title: "Today’s set",
    text: "Picks problems from your weakest topics and counts them against a daily goal you choose.",
  },
  {
    chip: "Topics",
    title: "Topic map",
    text: "One shared topic list across all three platforms, with coverage shown at your level.",
  },
  {
    chip: "Social",
    title: "Friends",
    text: "Weekly boards with your friends, weighted by problem difficulty.",
  },
];

async function HeroCta() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <Link href="/today" className={buttonVariants({ size: "lg" })}>
        Open Today
      </Link>
    );
  }
  return <SignInButtons size="lg" />;
}

const ERROR_TEXT: Record<string, string> = {
  account_not_linked:
    "An account with this email already exists. Sign in with the provider you used before.",
};

async function SignInError({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { error } = await searchParams;
  if (!error) return null;
  const code = Array.isArray(error) ? error[0] : error;
  return (
    <p
      role="alert"
      className="max-w-[56ch] rounded-2xl bg-destructive/5 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/30"
    >
      {(code && ERROR_TEXT[code]) || "Sign-in didn’t complete. Please try again."}
    </p>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Page>
      <section className="mt-10 mb-12 grid justify-items-start gap-5 min-[760px]:mt-16">
        <h1 className="max-w-[16ch] font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.02] font-bold tracking-[-0.025em] text-balance">
          Every solve, one place.
        </h1>
        <p className="max-w-[56ch] text-lg text-muted-foreground">
          CodeLogs tracks Codeforces, AtCoder and LeetCode together, finds the topics you are behind
          on, and hands you today&apos;s problems.
        </p>
        <Suspense>
          <SignInError searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-12 w-44 rounded-full" />}>
          <HeroCta />
        </Suspense>
      </section>
      <ul className="grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-1">
        {FEATURES.map((f) => (
          <li key={f.title} className="grid">
            <Panel as="div" className="grid content-start gap-3">
              <Chip className="justify-self-start">{f.chip}</Chip>
              <h2 className="font-display text-2xl leading-tight font-semibold tracking-[-0.01em]">
                {f.title}
              </h2>
              <p className="text-muted-foreground">{f.text}</p>
            </Panel>
          </li>
        ))}
      </ul>
    </Page>
  );
}
