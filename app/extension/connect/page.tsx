import { Suspense } from "react";
import Link from "next/link";
import { SignInButtons } from "@/components/auth/sign-in-buttons";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel } from "@/components/kit/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { CONNECT_MARKER_ATTR } from "@/lib/extension";
import { getCurrentUser } from "@/lib/session";
import { ConnectStatus } from "./connect-status";

export const metadata = { title: "Connect the extension" };

export default function ExtensionConnectPage() {
  return (
    <Page className="max-w-3xl">
      <PageHead
        title="Connect the extension"
        description="Link the LogN browser extension to your account."
      />
      <Suspense
        fallback={
          <Panel aria-hidden>
            <Skeleton className="mb-4 h-7 w-48" />
            <Skeleton className="h-11 w-full rounded-full" />
          </Panel>
        }
      >
        <ConnectBody />
      </Suspense>
    </Page>
  );
}

async function ConnectBody() {
  const user = await getCurrentUser();
  if (!user) {
    const marker = { [CONNECT_MARKER_ATTR]: "signed-out" };
    return (
      <Panel {...marker}>
        <p className="mb-4 text-muted-foreground">
          Sign in to connect the LogN extension to your account.
        </p>
        <SignInButtons callbackURL="/extension/connect" />
      </Panel>
    );
  }
  return (
    <>
      <ConnectStatus username={user.username ?? user.name} />
      <p className="mt-4 text-sm">
        <Link href="/connect" className="text-foreground underline underline-offset-2">
          Back to Connect
        </Link>
      </p>
    </>
  );
}
