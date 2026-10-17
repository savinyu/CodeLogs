"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendFriendRequest, type FriendActionResult } from "@/app/friends/actions";
import { Button } from "@/components/ui/button";

type State = FriendActionResult | null;

/** "Add by username" + Send (Coach's .add-form), with a live message line under it. */
export function AddFriendForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    const raw = formData.get("username");
    return sendFriendRequest(typeof raw === "string" ? raw : "");
  }, null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div>
      <form ref={formRef} action={action} className="flex gap-2">
        <label htmlFor="add-user" className="sr-only">
          CodeLogs username to add
        </label>
        <input
          id="add-user"
          name="username"
          placeholder="Add by username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 rounded-full border-0 bg-raised px-4 text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="sm" className="h-10 px-5" disabled={pending}>
          Send
        </Button>
      </form>
      <p
        aria-live="polite"
        className={`mt-1.5 min-h-[1.55em] text-sm ${state && !state.ok ? "text-destructive" : "text-muted-foreground"}`}
      >
        {state ? (state.ok ? state.message : state.error) : ""}
      </p>
    </div>
  );
}
