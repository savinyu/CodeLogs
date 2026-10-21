"use client";

import { useState, useTransition } from "react";
import { respondToRequest, sendFriendRequest } from "@/app/friends/actions";
import { Chip } from "@/components/kit/chip";
import { Button } from "@/components/ui/button";

type State = "none" | "friends" | "outgoing" | "incoming";

/** Friend button for a public profile: add, request sent, accept, or the Friends chip. */
export function AddFriendButton({ username, state }: { username: string; state: State }) {
  const [current, setCurrent] = useState<State>(state);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (current === "friends") return <Chip tone="good">Friends</Chip>;
  if (current === "outgoing") {
    return (
      <Button variant="outline" size="sm" disabled>
        Request sent
      </Button>
    );
  }

  function run(task: () => ReturnType<typeof sendFriendRequest>, next: State) {
    start(async () => {
      const result = await task();
      if (result.ok) {
        setError(null);
        setCurrent(next);
      } else if (result.code === "pending_out") {
        setError(null);
        setCurrent("outgoing");
      } else if (result.code === "pending_in") {
        setError(null);
        setCurrent("incoming");
      } else if (result.code === "friends") {
        setError(null);
        setCurrent("friends");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {current === "incoming" ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => respondToRequest({ username, accept: true }), "friends")}
        >
          Accept request
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => sendFriendRequest(username), "outgoing")}
        >
          Add friend
        </Button>
      )}
      <span aria-live="polite" className="text-sm text-destructive">
        {error ?? ""}
      </span>
    </span>
  );
}
