"use client";

import { useId } from "react";
import { cn } from "cn";

/**
 * A labelled checkbox drawn as Coach's rounded tick box (.done-label): rose when checked, or
 * green for `tone="good"` (something that ticked itself, such as a synced solve).
 */
export function CheckLabel({
  checked,
  onCheckedChange,
  disabled = false,
  tone = "primary",
  children,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  tone?: "primary" | "good";
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-2 text-[0.906rem] font-semibold text-muted-foreground",
        disabled ? "cursor-default" : "cursor-pointer",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className={cn(
          "grid size-6 shrink-0 appearance-none place-items-center rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          "after:hidden after:h-[11px] after:w-1.5 after:-translate-x-px after:-translate-y-px after:rotate-45 after:border-r-[2.5px] after:border-b-[2.5px] after:border-primary-foreground checked:after:block",
          tone === "good" ? "checked:bg-good" : "checked:bg-primary",
          !disabled && "cursor-pointer",
        )}
      />
      {children}
    </label>
  );
}
