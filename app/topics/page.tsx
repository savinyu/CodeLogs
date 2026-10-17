import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";

export const metadata = { title: "Topics" };

// Placeholder until V4 (PLAN-v2.md §7) builds the page.
export default function TopicsPage() {
  return (
    <Page>
      <PageHead title="Topics" description="Your solves on one shared topic map." />
    </Page>
  );
}
