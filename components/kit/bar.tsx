import { cn } from "cn";

type Tone = "weak" | "ontrack" | "strong" | "neutral";
type Size = "sm" | "md" | "lg";

const FILL: Record<Tone, string> = {
  weak: "bg-primary",
  ontrack: "bg-track",
  strong: "bg-good",
  neutral: "bg-foreground",
};
const HEIGHT: Record<Size, string> = { sm: "h-2", md: "h-2.5", lg: "h-3" };
const MARKER_WIDTH: Record<Size, string> = { sm: "w-0.5", md: "w-[3px]", lg: "w-[3px]" };

const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** A horizontal progress bar (Coach's .bar). `value` and `marker` are fractions from 0 to 1. */
export function Bar({
  value,
  tone = "weak",
  marker,
  size = "lg",
  label,
}: {
  value: number;
  tone?: Tone;
  /** Expected value, drawn as a tick. */
  marker?: number;
  size?: Size;
  label: string;
}) {
  const v = clamp(value);
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative rounded-full bg-muted", HEIGHT[size])}
    >
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full", FILL[tone], v > 0 && "min-w-1.5")}
        style={{ width: `${v * 100}%` }}
      />
      {marker !== undefined ? (
        <div
          className={cn(
            "absolute -top-1 -bottom-1 -ml-px rounded-sm bg-foreground",
            MARKER_WIDTH[size],
          )}
          style={{ left: `${clamp(marker) * 100}%` }}
        />
      ) : null}
    </div>
  );
}
