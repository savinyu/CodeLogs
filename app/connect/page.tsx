import { Suspense } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { listPlatformAccounts } from "@/lib/accounts";
import { listApiTokens } from "@/lib/api-tokens";
import { MAX_TOKENS_PER_USER } from "@/lib/api-tokens-shared";
import { EXTENSION_STORE_URL } from "@/lib/extension";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";
import { requireUser } from "@/lib/session";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "./auto-refresh";
import { ExtensionTokens } from "./extension-tokens";
import { PlatformCard } from "./platform-card";
import { SyncButton } from "./sync-button";

export const metadata = { title: "Connect platforms" };

export default function ConnectPage() {
  return (
    <Page className="max-w-3xl">
      <PageHead
        title="Connect your platforms"
        description="Add one handle per platform and we'll pull in your solved problems."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <PlatformCards />
      </Suspense>
      <Suspense fallback={<PanelSkeleton />}>
        <ExtensionPanel />
      </Suspense>
    </Page>
  );
}

async function PlatformCards() {
  const user = await requireUser();
  const accounts = await listPlatformAccounts(user.id);
  const anySyncing = accounts.some((a) => a.status === "syncing");
  return (
    <>
      {anySyncing && <AutoRefresh />}
      {accounts.length > 0 && (
        <div className="mb-3 flex justify-end">
          <SyncButton label="Sync all" disabled={anySyncing} />
        </div>
      )}
      <div className="grid gap-4">
        {PLATFORM_ORDER.map((id) => {
          const meta = PLATFORM_META[id];
          const account = accounts.find((a) => a.platform === id) ?? null;
          return (
            <PlatformCard
              key={id}
              platform={id}
              name={meta.name}
              handleHint={meta.handleHint}
              note={meta.note ?? null}
              account={
                account && {
                  handle: account.handle,
                  profileUrl: meta.profileUrl(account.handle),
                  status: account.status,
                  verified: account.verified,
                  verifyToken: account.verifyToken,
                  historyComplete: account.historyComplete,
                  lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
                  lastError: account.lastError,
                }
              }
            />
          );
        })}
      </div>
    </>
  );
}

/** Sits under the LeetCode card (last in PLATFORM_ORDER), since it only feeds LeetCode. */
async function ExtensionPanel() {
  const user = await requireUser();
  const tokens = await listApiTokens(user.id);
  return (
    <Panel id="extension" aria-labelledby="extension-title" className="mt-4">
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <PlatformDot platform="leetcode" />
            LeetCode browser extension
          </span>
        }
        titleId="extension-title"
      >
        LeetCode&apos;s public API only shows your 20 most recent accepted submissions. The CodeLogs
        extension reads your full solved list (with dates) from your own logged-in browser and sends
        it here, so your LeetCode history stays complete without pasting. Your LeetCode cookies
        never leave your browser.
      </PanelHeader>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        {EXTENSION_STORE_URL ? (
          <li>
            Install the extension from the{" "}
            <a
              href={EXTENSION_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              Chrome Web Store
            </a>
            .
          </li>
        ) : (
          <li>
            Install the extension. It isn&apos;t on the Chrome Web Store yet, so load the{" "}
            <code>extension/</code> folder of the CodeLogs repo as an unpacked extension
            (chrome://extensions → Developer mode → Load unpacked).
          </li>
        )}
        <li>Create a token below, paste it into the extension and click Save.</li>
        <li>While logged in to LeetCode, click Sync LeetCode history in the extension.</li>
      </ol>
      {EXTENSION_STORE_URL ? (
        <a
          href={EXTENSION_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", className: "mb-4" })}
        >
          Add to Chrome
          <ExternalLinkIcon aria-hidden />
        </a>
      ) : null}
      <ExtensionTokens tokens={tokens} maxTokens={MAX_TOKENS_PER_USER} />
    </Panel>
  );
}

function PanelSkeleton() {
  return (
    <Panel aria-hidden className="mt-4">
      <Skeleton className="mb-4 h-7 w-32" />
      <Skeleton className="h-11 w-full rounded-full" />
    </Panel>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      {PLATFORM_ORDER.map((id) => (
        <Panel key={id}>
          <Skeleton className="mb-4 h-7 w-32" />
          <Skeleton className="h-11 w-full rounded-full" />
        </Panel>
      ))}
    </div>
  );
}
