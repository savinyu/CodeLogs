"use client";

import { useActionState } from "react";
import { SOCIAL_META } from "@/components/social-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SOCIAL_KINDS, type SocialKind, type SocialLinks } from "@/lib/social-links-shared";
import { saveSocialLinks, type SocialLinksState } from "./actions";

const FIELDS: Record<SocialKind, { placeholder: string; type: string }> = {
  x: { placeholder: "handle or x.com link", type: "text" },
  instagram: { placeholder: "username or instagram.com link", type: "text" },
  website: { placeholder: "https://example.com", type: "url" },
  email: { placeholder: "you@example.com", type: "email" },
};

export function SocialLinksForm({ links }: { links: SocialLinks }) {
  const [state, action, pending] = useActionState<SocialLinksState, FormData>(
    saveSocialLinks,
    null,
  );
  const values = state?.values ?? links;

  return (
    // noValidate: the server's messages are clearer than the browser's, and accept bare domains.
    <form action={action} noValidate className="grid gap-3">
      {SOCIAL_KINDS.map((kind) => {
        const { name, Icon } = SOCIAL_META[kind];
        const error = state?.errors[kind];
        return (
          <div key={kind} className="grid gap-1.5">
            <Label htmlFor={`social-${kind}`}>
              <Icon className="size-4 text-muted-foreground" />
              {name}
            </Label>
            <Input
              id={`social-${kind}`}
              name={kind}
              type={FIELDS[kind].type}
              placeholder={FIELDS[kind].placeholder}
              defaultValue={values[kind] ?? ""}
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              className="h-11 rounded-full border-0 bg-raised px-4 dark:bg-raised"
              aria-describedby={error ? `social-${kind}-error` : undefined}
            />
            {error && (
              <p id={`social-${kind}-error`} className="text-sm text-primary-ink">
                {error}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save links"}
        </Button>
        {state?.message && (
          <p
            role="status"
            className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-primary-ink"}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
