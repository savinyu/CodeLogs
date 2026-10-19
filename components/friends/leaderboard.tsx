import { Note } from "@/components/kit/note";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { SegmentedLinks } from "@/components/kit/segmented-links";
import type { RankedEntry } from "@/lib/friends/points";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platforms";
import { BoardRow } from "./board-row";

type Row = RankedEntry & { isPublic?: boolean };

/** The large "This week" panel: board switch, count line, ranked rows and platform legend. */
export function Leaderboard({
  board,
  weekLabel,
  rows,
  meRow,
  meId,
  friendCount,
  listed,
  isListed,
  isPublic,
}: {
  board: "friends" | "global";
  weekLabel: string;
  rows: Row[];
  /** Global only: your row under the gap, when you are listed outside the top 10. */
  meRow?: Row | null;
  meId: string;
  friendCount: number;
  /** Global only: how many public profiles are on the board. */
  listed: number;
  isListed: boolean;
  isPublic: boolean;
}) {
  const count =
    board === "friends"
      ? `You and ${friendCount} ${friendCount === 1 ? "friend" : "friends"}`
      : `${listed.toLocaleString("en-US")} public ${listed === 1 ? "profile" : "profiles"} · top 10${isListed ? " and you" : ""}`;

  // Only platforms that earned points on this board.
  const onBoard = PLATFORM_ORDER.filter((p) =>
    [...rows, ...(meRow ? [meRow] : [])].some((r) => (r.platforms[p] ?? 0) > 0),
  );

  return (
    <Panel size="lg" aria-labelledby="board-title">
      <PanelHeader
        title="This week"
        titleId="board-title"
        info="A solve earns points by difficulty: Band 1 = 1 point up to Band 5 = 5; unrated = 1. Only verified handles count. Boards share only this week's points and solves, nothing from your private dashboard."
        action={
          <SegmentedLinks
            label="Leaderboard"
            onCard
            items={[
              { href: "/friends", label: "Friends", active: board === "friends" },
              { href: "/friends?board=global", label: "Global", active: board === "global" },
            ]}
          />
        }
      >
        {weekLabel}, UTC &middot; resets every Monday
      </PanelHeader>
      <p className="-mt-1 mb-3.5 text-sm text-muted-foreground">{count}</p>
      {rows.length > 0 ? (
        <ol
          aria-label={`${board === "friends" ? "Friends" : "Global"} leaderboard, this week`}
          className="m-0 grid list-none gap-2 p-0"
        >
          {rows.map((entry) => (
            <BoardRow key={entry.userId} entry={entry} isMe={entry.userId === meId} />
          ))}
          {meRow ? (
            <>
              <li
                aria-hidden="true"
                className="text-center leading-none font-bold tracking-[0.3em] text-muted-foreground"
              >
                &middot;&middot;&middot;
              </li>
              <BoardRow entry={meRow} isMe />
            </>
          ) : null}
        </ol>
      ) : (
        <p className="rounded-item bg-muted px-4.5 py-3.5 text-[0.9375rem] text-muted-foreground">
          Nobody is on this board yet.
        </p>
      )}
      {board === "global" && !isListed ? (
        <Note className="mt-3">
          <span>
            You are not on the global board.{" "}
            {isPublic
              ? "Turn it on in the profile menu."
              : "Make your profile public, then turn it on in the profile menu."}
          </span>
        </Note>
      ) : null}
      {onBoard.length > 0 ? (
        <ul className="mt-4 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-sm text-muted-foreground">
          {onBoard.map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <PlatformDot platform={p} />
              {PLATFORM_META[p].name}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
