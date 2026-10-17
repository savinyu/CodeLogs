import { Suspense } from "react";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listApiTokens } from "@/lib/api-tokens";
import { MAX_TOKENS_PER_USER } from "@/lib/api-tokens-shared";
import { requireUser } from "@/lib/session";
import { getSocialLinks } from "@/lib/social-links";
import { getUserSettings } from "@/lib/user-settings";
import { DailyGoalForm } from "./daily-goal-form";
import { DeleteAccountForm } from "./delete-account-form";
import { ExtensionTokens } from "./extension-tokens";
import { SocialLinksForm } from "./social-links-form";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Page className="max-w-3xl">
      <PageHead title="Settings" />
      <div className="grid gap-4">
        <Suspense fallback={<PanelSkeleton />}>
          <DailyGoalPanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <SocialLinksPanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <ExtensionPanel />
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
        {user.username &&
          ` GitHub (@${user.username}) comes from your sign-in and is always shown.`}
      </PanelHeader>
      <SocialLinksForm links={links} />
    </Panel>
  );
}

async function ExtensionPanel() {
  const user = await requireUser();
  const tokens = await listApiTokens(user.id);
  return (
    <Panel id="extension" aria-labelledby="extension-title">
      <PanelHeader title="Browser extension" titleId="extension-title">
        The CodeLogs extension reads your full LeetCode solved list (with dates) from your own
        logged-in browser and sends it here, so your LeetCode history stays complete. Your LeetCode
        cookies never leave your browser. Create a token, then paste it into the extension.
        <br />
        Load the <code>extension/</code> folder of the CodeLogs repo as an unpacked extension
        (chrome://extensions → Developer mode → Load unpacked).
      </PanelHeader>
      <ExtensionTokens tokens={tokens} maxTokens={MAX_TOKENS_PER_USER} />
    </Panel>
  );
}

async function DeletePanel() {
  const user = await requireUser();
  return (
    <Panel aria-labelledby="delete-title" className="bg-destructive/5 ring-1 ring-destructive/30">
      <PanelHeader
        title={<span className="text-destructive">Delete account</span>}
        titleId="delete-title"
      >
        This permanently deletes your CodeLogs account, your connected handles, your synced solves
        and stats, and your public profile. It cannot be undone. It does not touch your accounts on
        Codeforces, AtCoder, LeetCode or GitHub.
      </PanelHeader>
      <DeleteAccountForm username={user.username} />
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
