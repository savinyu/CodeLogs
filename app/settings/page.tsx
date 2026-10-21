import { Suspense } from "react";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { getSocialLinks } from "@/lib/social-links";
import { getUserSettings } from "@/lib/user-settings";
import { DailyGoalForm } from "./daily-goal-form";
import { DeleteAccountForm } from "./delete-account-form";
import { SocialLinksForm } from "./social-links-form";
import { UsernameForm } from "./username-form";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Page className="max-w-3xl">
      <PageHead title="Settings" />
      <div className="grid gap-4">
        <Suspense fallback={<PanelSkeleton />}>
          <UsernamePanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <DailyGoalPanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <SocialLinksPanel />
        </Suspense>
        <Panel aria-labelledby="export-title">
          <PanelHeader title="Export your data" titleId="export-title">
            Download a JSON file with your profile, settings, connected handles, solved problems,
            activity days, platform stats, daily marks, sheet follows and ticks, and your friends
            list (usernames only). It never includes sign-in tokens or sessions.
          </PanelHeader>
          <a href="/api/export" download className={buttonVariants({ variant: "outline" })}>
            Download my data
          </a>
        </Panel>
        <Suspense fallback={<PanelSkeleton />}>
          <DeletePanel />
        </Suspense>
      </div>
    </Page>
  );
}

async function UsernamePanel() {
  const user = await requireUser();
  const { username, canChangeUsername } = await getUserSettings(user.id);
  return (
    <Panel aria-labelledby="username-title">
      <PanelHeader
        title="Username"
        titleId="username-title"
        className={canChangeUsername ? undefined : "mb-0"}
      >
        {username ? (
          <>
            You are <span className="font-semibold text-foreground">@{username}</span>. Friends add
            you by it, and your public profile is at{" "}
            <span className="font-semibold text-foreground">/u/{username}</span>.
          </>
        ) : (
          "Pick a username so friends can add you and your profile gets a public link."
        )}
        {canChangeUsername
          ? " You can change it once."
          : " You have used your one change, so it can't be changed again."}
      </PanelHeader>
      {canChangeUsername && <UsernameForm username={username} />}
    </Panel>
  );
}

async function DailyGoalPanel() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  return (
    <Panel aria-labelledby="daily-goal-title">
      <PanelHeader title="Daily goal" titleId="daily-goal-title">
        Problems per day on Today’s goal ring. Counts your activity for the UTC day.
      </PanelHeader>
      <DailyGoalForm goal={settings.dailyGoal} />
    </Panel>
  );
}

async function SocialLinksPanel() {
  const user = await requireUser();
  const links = await getSocialLinks(user.id);
  return (
    <Panel id="social-links" aria-labelledby="social-links-title">
      <PanelHeader title="Social links" titleId="social-links-title">
        Shown as icons on your public profile. Leave a field empty to remove it.
        {user.githubLogin &&
          ` GitHub (@${user.githubLogin}) comes from your sign-in and is always shown.`}
      </PanelHeader>
      <SocialLinksForm links={links} />
    </Panel>
  );
}

async function DeletePanel() {
  const user = await requireUser();
  // The DB's username, which deleteAccount checks: the session's lags after a username change.
  const { username } = await getUserSettings(user.id);
  return (
    <Panel aria-labelledby="delete-title" className="bg-destructive/5 ring-1 ring-destructive/30">
      <PanelHeader
        title={<span className="text-destructive">Delete account</span>}
        titleId="delete-title"
      >
        This permanently deletes your CodeLogs account, your connected handles, your synced solves
        and stats, and your public profile. It cannot be undone. It does not touch your accounts on
        Codeforces, AtCoder, LeetCode, GitHub or Google.
      </PanelHeader>
      <DeleteAccountForm username={username} />
    </Panel>
  );
}

function PanelSkeleton() {
  return (
    <Panel aria-hidden>
      <Skeleton className="mb-4 h-7 w-32" />
      <Skeleton className="h-11 w-full rounded-full" />
    </Panel>
  );
}
