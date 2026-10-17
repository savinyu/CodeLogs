"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  cancelRequest,
  removeFriend,
  respondToRequest,
  type FriendActionResult,
} from "@/app/friends/actions";
import { Chip } from "@/components/kit/chip";
import { UserAvatar } from "@/components/kit/user-avatar";
import { Button } from "@/components/ui/button";
import type { FriendPerson } from "@/lib/friends/queries";

function Person({
  person,
  sub,
  children,
}: {
  person: FriendPerson;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[14px] bg-raised py-2.5 pr-3.5 pl-2.5">
      <UserAvatar
        name={person.name}
        image={person.image}
        shape="squircle"
        size="sm"
        className="size-9"
      />
      <span className="grid min-w-30 flex-1 gap-[3px]">
        <span className="font-semibold [overflow-wrap:anywhere]">{person.name}</span>
        <span className="text-[0.844rem] text-muted-foreground [overflow-wrap:anywhere]">
          {person.username ? (
            <Link
              href={`/u/${person.username}`}
              className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              @{person.username}
            </Link>
          ) : null}
          {sub ? ` · ${sub}` : ""}
        </span>
      </span>
      {children}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 grid gap-2.5 border-t border-border pt-4">
      <h3 className="text-[0.9375rem] font-bold tracking-[0.05em] text-muted-foreground uppercase">
        {title}
      </h3>
      <ul className="m-0 grid list-none gap-2 p-0">{children}</ul>
    </div>
  );
}

/** Requests, sent requests and the friend list, each with its actions. */
export function FriendLists({
  incoming,
  outgoing,
  friends,
}: {
  incoming: FriendPerson[];
  outgoing: FriendPerson[];
  friends: FriendPerson[];
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FriendActionResult | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  function run(task: () => Promise<FriendActionResult>) {
    start(async () => {
      setResult(await task());
      setConfirming(null);
    });
  }

  const sorted = [...friends].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <p
        aria-live="polite"
        className={`text-sm ${result && !result.ok ? "text-destructive" : "text-muted-foreground"} ${result ? "mt-1" : ""}`}
      >
        {result ? (result.ok ? result.message : result.error) : ""}
      </p>
      {incoming.length > 0 && (
        <Section title="Requests">
          {incoming.map((p) => (
            <Person key={p.userId} person={p} sub="wants to be friends">
              <span className="flex gap-1.5">
                <Button
                  size="sm"
                  disabled={pending || !p.username}
                  onClick={() =>
                    run(() => respondToRequest({ username: p.username, accept: true }))
                  }
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-muted hover:bg-border"
                  disabled={pending || !p.username}
                  onClick={() =>
                    run(() => respondToRequest({ username: p.username, accept: false }))
                  }
                >
                  Decline
                </Button>
              </span>
            </Person>
          ))}
        </Section>
      )}
      {outgoing.length > 0 && (
        <Section title="Sent">
          {outgoing.map((p) => (
            <Person key={p.userId} person={p}>
              <span className="flex items-center gap-2">
                <Chip>Pending</Chip>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-muted hover:bg-border"
                  disabled={pending || !p.username}
                  onClick={() => run(() => cancelRequest(p.username))}
                >
                  Cancel
                </Button>
              </span>
            </Person>
          ))}
        </Section>
      )}
      <Section title="Your friends">
        {sorted.length === 0 ? (
          <li className="text-[0.9375rem] text-muted-foreground">
            No friends yet. Add someone by username.
          </li>
        ) : (
          sorted.map((p) => (
            <Person key={p.userId} person={p}>
              {confirming === p.userId ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  Remove?
                  <Button
                    size="xs"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => run(() => removeFriend(p.username))}
                  >
                    Yes
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="bg-muted hover:bg-border"
                    disabled={pending}
                    onClick={() => setConfirming(null)}
                  >
                    No
                  </Button>
                </span>
              ) : (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending || !p.username}
                  aria-label={`Remove ${p.name}`}
                  onClick={() => setConfirming(p.userId)}
                >
                  Remove
                </Button>
              )}
            </Person>
          ))
        )}
      </Section>
    </div>
  );
}
