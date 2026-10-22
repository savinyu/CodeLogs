"use client";

import { useActionState, useState } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CONTACT_MAX,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_KINDS,
  MESSAGE_MAX,
  MESSAGE_MIN,
  type FeedbackKind,
} from "@/lib/feedback-shared";
import { sendFeedback, type FeedbackState } from "./actions";

export function FeedbackForm() {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, null);
  // Controlled, so a failed submit keeps what was typed (form actions reset uncontrolled fields).
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");

  if (state?.ok) {
    return (
      <div role="status" className="grid justify-items-start gap-3">
        <p className="flex items-center gap-2 font-display text-xl font-semibold">
          <CheckCircle2Icon aria-hidden="true" className="size-5 text-good" />
          Thanks, your feedback was sent.
        </p>
        <p className="text-muted-foreground">I read every message.</p>
      </div>
    );
  }

  const errors = state?.errors ?? {};

  return (
    <form action={action} noValidate className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">What is it about?</legend>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                "cursor-pointer rounded-full px-4 py-1.5 text-[0.906rem] font-semibold has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                kind === k
                  ? "bg-foreground text-background"
                  : "bg-raised text-muted-foreground hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {FEEDBACK_KIND_LABELS[k]}
            </label>
          ))}
        </div>
        {errors.kind && <p className="text-sm text-primary-ink">{errors.kind}</p>}
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="feedback-message">Your message</Label>
        <textarea
          id="feedback-message"
          name="message"
          rows={6}
          maxLength={MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What went wrong, or what would make LogN better?"
          aria-invalid={errors.message ? true : undefined}
          aria-describedby="feedback-message-hint"
          className="min-h-36 w-full resize-y rounded-[20px] bg-raised px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        />
        <p
          id="feedback-message-hint"
          className={cn("text-sm", errors.message ? "text-primary-ink" : "text-muted-foreground")}
        >
          {errors.message ?? `${message.length} / ${MESSAGE_MAX} · at least ${MESSAGE_MIN}`}
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="feedback-contact">Email (optional, if you&apos;d like a reply)</Label>
        <Input
          id="feedback-contact"
          name="contact"
          type="email"
          maxLength={CONTACT_MAX}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={errors.contact ? true : undefined}
          aria-describedby={errors.contact ? "feedback-contact-error" : undefined}
          className="h-11 rounded-full border-0 bg-raised px-4 dark:bg-raised"
        />
        {errors.contact && (
          <p id="feedback-contact-error" className="text-sm text-primary-ink">
            {errors.contact}
          </p>
        )}
      </div>

      {/* Honeypot: hidden from people and screen readers; bots that fill it are ignored. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send feedback"}
        </Button>
        {state?.message && (
          <p role="alert" className="text-sm text-primary-ink">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
