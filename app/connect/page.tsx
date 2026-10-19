import { Suspense } from "react";
import { cn } from "cn";
import { ExternalLinkIcon } from "lucide-react";
import { listPlatformAccounts } from "@/lib/accounts";
import { listApiTokens } from "@/lib/api-tokens";
import { EXTENSION_STORE_URL } from "@/lib/extension";
import { PLATFORM_META, PLATFORM_ORDER, isSyncedPlatform } from "@/lib/platforms";
import { requireUser } from "@/lib/session";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "./auto-refresh";
import { ExtensionTokens } from "./extension-tokens";
import { PlatformCard, type PlatformCardProps } from "./platform-card";
import { SyncButton } from "./sync-button";

export const metadata = { title: "Connect platforms" };

const SYNCED_IDS = PLATFORM_ORDER.filter((id) => isSyncedPlatform(id));
const EXTENSION_IDS = PLATFORM_ORDER.filter((id) => !isSyncedPlatform(id));

export default function ConnectPage() {
  return (
    <Page className="max-w-3xl">
      <PageHead
        title="Connect your platforms"
        description="Add one handle per platform and we'll pull in your solved problems."
      />
      <Suspense fallback={<CardsSkeleton ids={SYNCED_IDS} />}>
        <PlatformCards />
      </Suspense>
      <section aria-labelledby="extension-section" className="mt-10">
        <h2
          id="extension-section"
          className="font-display text-3xl leading-tight font-bold tracking-[-0.01em]"
        >
          With the browser extension
        </h2>
        <p className="mt-1.5 mb-5 max-w-[68ch] text-muted-foreground">
          The extension reads these platforms in your own logged-in browser and keeps them in sync.
          CodeLogs never fetches them itself.
        </p>
        <Suspense
          fallback={
            <>
              <PanelSkeleton />
              <CardsSkeleton ids={EXTENSION_IDS} className="mt-4" />
            </>
          }
        >
          <ExtensionSection />
        </Suspense>
      </section>
    </Page>
  );
}

type Account = Awaited<ReturnType<typeof listPlatformAccounts>>[number];

function cardFor(id: (typeof PLATFORM_ORDER)[number], accounts: Account[]) {
  const meta = PLATFORM_META[id];
  const account = accounts.find((a) => a.platform === id) ?? null;
  const props: PlatformCardProps["account"] = account && {
    handle: account.handle,
    profileUrl: meta.profileUrl(account.handle),
    status: account.status,
    verified: account.verified,
    verifyToken: account.verifyToken,
    historyComplete: account.historyComplete,
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
    lastError: account.lastError,
  };
  return (
    <PlatformCard
      key={id}
      platform={id}
      name={meta.name}
      handleHint={meta.handleHint}
      note={meta.note ?? null}
      account={props}
    />
  );
}

async function PlatformCards() {
  const user = await requireUser();
  const accounts = await listPlatformAccounts(user.id);
  const synced = accounts.filter((a) => isSyncedPlatform(a.platform));
  const anySyncing = synced.some((a) => a.status === "syncing");
  return (
    <>
      {anySyncing && <AutoRefresh />}
      {synced.length > 0 && (
        <div className="mb-3 flex justify-end">
          <SyncButton label="Sync all" disabled={anySyncing} />
        </div>
      )}
      <div className="grid gap-4">{SYNCED_IDS.map((id) => cardFor(id, accounts))}</div>
    </>
  );
}

/** The extension panel (install and connected browsers) heads the five extension-only platforms. */
async function ExtensionSection() {
  const user = await requireUser();
  const [tokens, accounts] = await Promise.all([
    listApiTokens(user.id),
    listPlatformAccounts(user.id),
  ]);
  return (
    <>
      <ExtensionPanel tokens={tokens} />
      <div className="mt-4 grid gap-4">{EXTENSION_IDS.map((id) => cardFor(id, accounts))}</div>
    </>
  );
}

function ExtensionPanel({ tokens }: { tokens: Awaited<ReturnType<typeof listApiTokens>> }) {
  return (
    <Panel id="extension" aria-labelledby="extension-title">
      <PanelHeader title="CodeLogs browser extension" titleId="extension-title">
        The extension reads your own logged-in browser and sends CodeLogs only handles, problem
        titles, difficulty, dates and counts. It syncs your full LeetCode history (the public API
        only shows your 20 most recent solves) and CodeChef, Code360, HackerRank, InterviewBit and
        GeeksforGeeks. Your cookies and passwords never leave your browser.
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
        <li>
          Open the extension and click <strong>Connect to CodeLogs</strong>. It links to this
          account: no token to copy.
        </li>
        <li>
          That&apos;s it. It syncs right away, then by itself: whenever you visit one of these sites
          (at most every 6 hours) and LeetCode once a day. You can turn automatic sync off in the
          extension, and Sync any platform by hand.
        </li>
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
      <ExtensionTokens tokens={tokens} />
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

function CardsSkeleton({ ids, className }: { ids: typeof PLATFORM_ORDER; className?: string }) {
  return (
    <div className={cn("grid gap-4", className)} aria-hidden>
      {ids.map((id) => (
        <Panel key={id}>
          <Skeleton className="mb-4 h-7 w-32" />
          <Skeleton className="h-11 w-full rounded-full" />
        </Panel>
      ))}
    </div>
  );
}
