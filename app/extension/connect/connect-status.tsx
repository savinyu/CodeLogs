"use client";

import { useEffect, useState } from "react";
import { Note } from "@/components/kit/note";
import { Panel } from "@/components/kit/panel";
import { CONNECT_EVENT, CONNECT_MARKER_ATTR, CONNECT_RESULT_KEY } from "@/lib/extension";

const marker = { [CONNECT_MARKER_ATTR]: "ready" };

type State = { kind: "waiting" } | { kind: "ok" } | { kind: "error"; message: string };

export function ConnectStatus({ username }: { username: string }) {
  const [state, setState] = useState<State>({ kind: "waiting" });
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    function settle(detail: unknown) {
      if (detail === "ok") setState({ kind: "ok" });
      else
        setState({
          kind: "error",
          message: typeof detail === "string" && detail ? detail : "Could not connect.",
        });
    }
    const onEvent = (e: Event) => settle((e as CustomEvent<unknown>).detail);
    document.addEventListener(CONNECT_EVENT, onEvent);
    // The extension may have finished before this page hydrated.
    let early: string | null = null;
    try {
      early = sessionStorage.getItem(CONNECT_RESULT_KEY);
    } catch {
      // storage blocked: wait for the event
    }
    if (early) settle(early);
    const timer = setTimeout(() => setSlow(true), 10_000);
    return () => {
      document.removeEventListener(CONNECT_EVENT, onEvent);
      clearTimeout(timer);
    };
  }, []);

  return (
    <Panel {...marker}>
      <div aria-live="polite" className="grid gap-3">
        {state.kind === "waiting" && <p>Connecting the extension to @{username}…</p>}
        {state.kind === "ok" && (
          <p>
            Connected. The extension is syncing your platforms now, and keeps them up to date by
            itself. You can close this tab.
          </p>
        )}
        {state.kind === "error" && (
          <Note className="bg-primary-soft text-primary-ink">
            <p>{state.message}</p>
          </Note>
        )}
        {state.kind === "waiting" && slow && (
          <p className="text-sm text-muted-foreground">
            Nothing happening? Open the LogN extension and click Connect to LogN.
          </p>
        )}
      </div>
    </Panel>
  );
}
