"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ApiTokenSummary } from "@/lib/api-tokens";
import { revokeExtensionToken } from "./extension-actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ExtensionTokens({ tokens }: { tokens: ApiTokenSummary[] }) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">Connected browsers</h3>
      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No browsers connected yet.</p>
      ) : (
        <ul className="grid gap-2">
          {tokens.map((t) => (
            <TokenRow key={t.id} token={t} />
          ))}
        </ul>
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
      try {
        const res = await revokeExtensionToken(token.id);
        if (res.ok) return;
      } catch {
        // Treated like a returned failure below.
      }
      setError("Could not revoke this token. Try again.");
      setConfirming(false);
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-item bg-raised p-4">
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium">{token.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{token.tokenPrefix}…</p>
        <p className="text-xs text-muted-foreground">
          Created {formatDate(token.createdAt)}
          {" · "}
          {token.lastUsedAt ? `Last used ${formatDate(token.lastUsedAt)}` : "Never used"}
        </p>
        {error && (
          <p role="alert" className="text-xs text-primary-ink">
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
