import { Suspense } from "react";
import { FriendsCard } from "@/components/friends/friends-card";
import { Leaderboard } from "@/components/friends/leaderboard";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Skeleton } from "@/components/ui/skeleton";
import { rankBoard } from "@/lib/friends/points";
import { getBoardEntries, getFriendsState, getGlobalBoard } from "@/lib/friends/queries";
import { weekLabel, weekStart } from "@/lib/friends/week";
import { renderNow } from "@/lib/clock";
import { requireUser } from "@/lib/session";
import { getUserSettings } from "@/lib/user-settings";

export const metadata = { title: "Friends" };

async function FriendsContent({ searchParams }: Pick<PageProps<"/friends">, "searchParams">) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const board = query.board === "global" ? "global" : "friends";
  const now = new Date(await renderNow());
  const since = weekStart(now);

  const [state, settings, global] = await Promise.all([
    getFriendsState(user.id),
    getUserSettings(user.id),
    board === "global" ? getGlobalBoard(user.id, since) : null,
  ]);

  const rows = global
    ? global.top
    : rankBoard(await getBoardEntries([user.id, ...state.friends.map((f) => f.userId)], since));

  return (
    <div className="grid grid-cols-1 items-start gap-5 min-[900px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Leaderboard
        board={board}
        weekLabel={weekLabel(now)}
        rows={rows}
        meRow={global?.me}
        meId={user.id}
        friendCount={state.friends.length}
        listed={global?.listed ?? 0}
        isListed={global?.isListed ?? false}
        isPublic={settings.publicProfile}
      />
      <FriendsCard state={state} />
    </div>
  );
}

function FriendsSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-5 min-[900px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Skeleton className="h-[34rem] rounded-card-lg" />
      <Skeleton className="h-[26rem] rounded-card" />
    </div>
  );
}

export default function FriendsPage({ searchParams }: PageProps<"/friends">) {
  return (
    <Page>
      <PageHead
        title="Friends"
        description="A weekly board for you and your friends, and a global one. Boards share only this week's points and solves, nothing from your private dashboard."
      />
      <Suspense fallback={<FriendsSkeleton />}>
        <FriendsContent searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}
