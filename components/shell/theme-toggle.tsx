"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const subscribe = () => () => {};

const ICONS = {
  system: (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect
        x="2"
        y="3"
        width="14"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M6 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  light: (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="3.5" fill="currentColor" />
      <path
        d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  dark: (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M15 10.5A6.5 6.5 0 0 1 7.5 3a6.5 6.5 0 1 0 7.5 7.5Z" fill="currentColor" />
    </svg>
  ),
} as const;

type Mode = keyof typeof ICONS;
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };

/** One round button that cycles system, light, dark. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown on the server: show the neutral icon until mounted.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const mode: Mode = mounted && (theme === "light" || theme === "dark") ? theme : "system";

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[mode])}
      aria-label={`Theme: ${mode}. Click to change.`}
      title={`Theme: ${mode}. Click to change.`}
      className="grid size-10 place-items-center rounded-full bg-card text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {ICONS[mode]}
    </button>
  );
}
