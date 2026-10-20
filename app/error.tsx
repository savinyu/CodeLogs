"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel } from "@/components/kit/panel";
import { Button, buttonVariants } from "@/components/ui/button";

/** The last-resort error boundary: a crash in any route lands here instead of a blank screen. */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page>
      <PageHead
        title="Something went wrong"
        description="That page failed to load. It may be a dropped connection."
      />
      <Panel className="flex flex-wrap items-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go home
        </Link>
      </Panel>
    </Page>
  );
}
