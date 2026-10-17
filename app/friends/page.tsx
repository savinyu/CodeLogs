import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";

export const metadata = { title: "Friends" };

// Placeholder until V6 (PLAN-v2.md §7) builds the page.
export default function FriendsPage() {
  return (
    <Page>
      <PageHead
        title="Friends"
        description="A weekly board for you and your friends, and a global one."
      />
    </Page>
  );
}
