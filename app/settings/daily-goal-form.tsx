"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setDailyGoal } from "./actions";

const MIN = 1;
const MAX = 20;

export function DailyGoalForm({ goal }: { goal: number }) {
  const [value, setValue] = useState(String(goal));
  const [saved, setSaved] = useState(goal);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const n = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(n) && n >= MIN && n <= MAX;

  function step(delta: number) {
    const base = Number.isInteger(n) ? n : saved;
    setValue(String(Math.min(MAX, Math.max(MIN, base + delta))));
    setMessage(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setMessage({ ok: false, text: `Use a whole number from ${MIN} to ${MAX}.` });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await setDailyGoal(n);
        if (result.ok) {
          setSaved(n);
          setMessage({ ok: true, text: "Saved." });
        } else {
          setMessage({ ok: false, text: result.error });
        }
      } catch {
        setMessage({ ok: false, text: "Could not save. Check your connection and try again." });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <Label htmlFor="daily-goal">Problems per day</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Decrease daily goal"
          disabled={pending || n <= MIN}
          onClick={() => step(-1)}
        >
          −
        </Button>
        <Input
          id="daily-goal"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage(null);
          }}
          aria-invalid={value !== "" && !valid ? true : undefined}
          className="h-11 w-20 rounded-full border-0 bg-raised px-4 text-center dark:bg-raised"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Increase daily goal"
          disabled={pending || n >= MAX}
          onClick={() => step(1)}
        >
          +
        </Button>
        <Button type="submit" disabled={pending || (valid && n === saved)}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={
          message?.ok === false ? "text-sm text-primary-ink" : "text-sm text-muted-foreground"
        }
      >
        {message?.text}
      </p>
    </form>
  );
}
