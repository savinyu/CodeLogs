import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";

export const metadata = { title: "Today" };

// Placeholder until V3 (PLAN-v2.md §7) builds the page.
export default function TodayPage() {
  return (
    <Page>
      <PageHead title="Today" description="Today's set, your week, and why these picks." />
    </Page>
  );
}
