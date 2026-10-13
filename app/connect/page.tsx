import { Suspense } from "react";
import { listPlatformAccounts } from "@/lib/accounts";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefresh } from "./auto-refresh";
import { PlatformCard } from "./platform-card";
import { SyncButton } from "./sync-button";

export const metadata = { title: "Connect platforms" };

export default function ConnectPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Connect your platforms</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add one handle per platform and we&apos;ll pull in your solved problems.
      </p>
      <Suspense fallback={<CardsSkeleton />}>
        <PlatformCards />
      </Suspense>
    </main>
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
        <div className="mt-6 flex justify-end">
          <SyncButton label="Sync all" disabled={anySyncing} />
        </div>
      )}
      <div className={accounts.length > 0 ? "mt-3 grid gap-4" : "mt-8 grid gap-4"}>
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
    <div className="mt-8 grid gap-4" aria-hidden>
      {PLATFORM_ORDER.map((id) => (
        <Card key={id}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
