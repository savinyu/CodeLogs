"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiTokenSummary } from "@/lib/api-tokens";
import { createExtensionToken, revokeExtensionToken, type CreateTokenState } from "./actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ExtensionTokens({
  tokens,
  maxTokens,
}: {
  tokens: ApiTokenSummary[];
  maxTokens: number;
}) {
  const [state, action, pending] = useActionState<CreateTokenState, FormData>(
    createExtensionToken,
    null,
  );
  const atLimit = tokens.length >= maxTokens;

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-1.5">
        <Label htmlFor="extension-token-name">Token name (optional)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="extension-token-name"
            name="name"
            placeholder="Browser extension"
            maxLength={60}
            autoComplete="off"
            className="min-w-0 flex-1 basis-48"
          />
          <Button type="submit" disabled={pending || atLimit}>
            {pending ? "Creating…" : "Create token"}
          </Button>
        </div>
        {atLimit && (
          <p className="text-sm text-muted-foreground">
            You have {maxTokens} tokens, the maximum. Revoke one to create another.
          </p>
        )}
      </form>

      <div aria-live="polite">
        {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.ok === true && <NewToken key={state.token} token={state.token} />}
      </div>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tokens.map((t) => (
            <TokenRow key={t.id} token={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-primary/40 bg-muted/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          readOnly
          value={token}
          aria-label="New API token"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 basis-48 font-mono text-xs"
        />
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Copy it now: you won&apos;t be able to see it again.
      </p>
      {failed && (
        <p className="text-sm text-destructive">Could not copy. Select the text and copy it.</p>
      )}
    </div>
  );
}

function TokenRow({ token }: { token: ApiTokenSummary }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function onRevoke() {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setError(null);
    startTransition(async () => {
      const res = await revokeExtensionToken(token.id);
      if (!res.ok) {
        setError("Could not revoke this token. Try again.");
        setConfirming(false);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3">
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium">{token.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{token.tokenPrefix}…</p>
        <p className="text-xs text-muted-foreground">
          Created {formatDate(token.createdAt)}
          {" · "}
          {token.lastUsedAt ? `Last used ${formatDate(token.lastUsedAt)}` : "Never used"}
        </p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant={confirming ? "destructive" : "outline"}
        size="sm"
        onClick={onRevoke}
        disabled={pending}
        aria-label={`${confirming ? "Confirm revoke" : "Revoke"} token ${token.name}`}
      >
        {pending ? "Revoking…" : confirming ? "Confirm revoke" : "Revoke"}
      </Button>
    </li>
  );
}
