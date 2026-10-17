import { Chip } from "@/components/kit/chip";
import { Panel, PanelHeader } from "@/components/kit/panel";
import type { FriendsState } from "@/lib/friends/queries";
import { AddFriendForm } from "./add-friend-form";
import { FriendLists } from "./friend-lists";

/** The side panel: add by username, requests, sent requests and your friends. */
export function FriendsCard({ state }: { state: FriendsState }) {
  return (
    <Panel aria-labelledby="friends-title">
      <PanelHeader
        title="Friends"
        titleId="friends-title"
        action={<Chip>{state.friends.length}</Chip>}
        className="mb-3"
      />
      <AddFriendForm />
      <FriendLists incoming={state.incoming} outgoing={state.outgoing} friends={state.friends} />
      <p className="mt-3.5 text-sm text-muted-foreground">
        Friends are mutual, so a request has to be accepted. You can also add someone from their
        public profile.
      </p>
    </Panel>
  );
}
