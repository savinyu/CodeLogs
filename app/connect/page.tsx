import { Suspense } from "react";
import { listPlatformAccounts } from "@/lib/accounts";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";
import { requireUser } from "@/lib/session";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel } from "@/components/kit/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "./auto-refresh";
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
