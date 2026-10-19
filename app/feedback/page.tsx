import Link from "next/link";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel } from "@/components/kit/panel";
import { FeedbackForm } from "./feedback-form";

export const metadata = {
  title: "Feedback",
  description: "Report a bug or suggest an idea for CodeLogs.",
};

export default function FeedbackPage() {
  return (
    <Page className="max-w-2xl">
      <PageHead
        title="Feedback"
        description="Found a bug, or have an idea that would make CodeLogs better? Tell me here."
      />
      <Panel size="lg">
        <FeedbackForm />
      </Panel>
      <p className="mt-4 text-sm text-muted-foreground">
        Messages are private. If you&apos;re signed in, yours is linked to your account. See the{" "}
        <Link href="/privacy" className="text-foreground underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </Page>
  );
}
