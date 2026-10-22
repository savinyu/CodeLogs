import { Suspense } from "react";
import { cn } from "cn";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { listPlatformAccounts, listRemovedPlatforms } from "@/lib/accounts";
import type { PlatformId } from "@/lib/adapters/types";
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
          LogN never fetches them itself.
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

function cardFor(id: (typeof PLATFORM_ORDER)[number], accounts: Account[], removed: PlatformId[]) {
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
      removed={removed.includes(id)}
    />
  );
}

async function PlatformCards() {
  const user = await requireUser();
  const [accounts, removed] = await Promise.all([
    listPlatformAccounts(user.id),
    listRemovedPlatforms(user.id),
  ]);
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
      <div className="grid gap-4">{SYNCED_IDS.map((id) => cardFor(id, accounts, removed))}</div>
    </>
  );
}

/** The extension panel (install and connected browsers) heads the five extension-only platforms. */
async function ExtensionSection() {
  const user = await requireUser();
  const [tokens, accounts, removed] = await Promise.all([
    listApiTokens(user.id),
    listPlatformAccounts(user.id),
    listRemovedPlatforms(user.id),
  ]);
  return (
    <>
      <ExtensionPanel tokens={tokens} />
      <div className="mt-4 grid gap-4">
        {EXTENSION_IDS.map((id) => cardFor(id, accounts, removed))}
      </div>
    </>
  );
}

function ExtensionPanel({ tokens }: { tokens: Awaited<ReturnType<typeof listApiTokens>> }) {
  return (
    <Panel id="extension" aria-labelledby="extension-title">
      <PanelHeader title="LogN browser extension" titleId="extension-title">
        The public API only shows your last 20 LeetCode solves. The extension syncs your full
        history, plus CodeChef, Code360, HackerRank, InterviewBit and GFG.
      </PanelHeader>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        {EXTENSION_STORE_URL ? (
          <li>
            <strong>Install:</strong> get the extension from the{" "}
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
            <strong>Install:</strong> chrome://extensions → Developer mode → Load unpacked → pick{" "}
            <code>extension/</code> from the LogN repo.
          </li>
        )}
        <li>
          <strong>Connect:</strong> open the extension → <strong>Connect to LogN</strong>.
        </li>
        <li>
          <strong>That&apos;s it.</strong> It syncs when you visit these sites (at most every 6 h)
          and LeetCode daily. You can pause it anytime.
        </li>
      </ol>
      <p className="mb-4 text-sm text-muted-foreground">
        Only handles, problem titles, difficulty and dates are sent. Never your cookies or
        passwords. <br />
        See{" "}
        <Link href="/privacy" className="text-foreground underline underline-offset-2">
          Privacy policy
        </Link>
      </p>
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
