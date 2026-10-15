import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { getSocialLinks } from "@/lib/social-links";
import { DeleteAccountForm } from "./delete-account-form";
import { SocialLinksForm } from "./social-links-form";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="mt-8 grid gap-4">
        <Suspense fallback={<CardSkeleton />}>
          <SocialLinksCard />
        </Suspense>
        <Card>
          <CardHeader>
            <CardTitle>Export your data</CardTitle>
            <CardDescription>
              Download a JSON file with your profile, connected handles, solved problems, activity
              days and platform stats. It never includes sign-in tokens or sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/api/export" download className={buttonVariants({ variant: "outline" })}>
              Download my data
            </a>
          </CardContent>
        </Card>
        <Suspense fallback={<CardSkeleton />}>
          <DeleteCard />
        </Suspense>
      </div>
    </main>
  );
}

async function SocialLinksCard() {
  const user = await requireUser();
  const links = await getSocialLinks(user.id);
  return (
    <Card id="social-links">
      <CardHeader>
        <CardTitle>Social links</CardTitle>
        <CardDescription>
          Shown as icons on your dashboard and public profile. Leave a field empty to remove it.
          {user.username &&
            ` GitHub (@${user.username}) comes from your sign-in and is always shown.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SocialLinksForm links={links} />
      </CardContent>
    </Card>
  );
}

async function DeleteCard() {
  const user = await requireUser();
  return (
    <Card className="ring-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>
          This permanently deletes your CodeLogs account, your connected handles, your synced solves
          and stats, and your public profile. It cannot be undone. It does not touch your accounts
          on Codeforces, AtCoder, LeetCode or GitHub.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DeleteAccountForm username={user.username} />
      </CardContent>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <Card aria-hidden>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}
