import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "./panel";

/** Shown in place of a page's content when the user has no platform accounts yet. */
export function ConnectPrompt({
  title = "Connect your platforms",
  description = "Add your Codeforces, AtCoder and LeetCode handles to start tracking.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Panel size="lg">
      <PanelHeader title={title}>{description}</PanelHeader>
      <Button nativeButton={false} render={<Link href="/connect" />}>
        Connect platforms
      </Button>
    </Panel>
  );
}
