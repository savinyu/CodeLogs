import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";

export const metadata = { title: "Progress" };

// Placeholder until V2 (PLAN-v2.md §7) builds the page.
export default function ProgressPage() {
  return (
    <Page>
      <PageHead
        title="Progress"
        description="Everything you have solved, across all three platforms."
      />
    </Page>
  );
}
