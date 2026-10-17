import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";

export const metadata = { title: "Contests" };

// Placeholder until V7 (PLAN-v2.md §7) builds the page.
export default function ContestsPage() {
  return (
    <Page>
      <PageHead
        title="Contests"
        description="Rating over time, and every contest's rating change."
      />
    </Page>
  );
}
