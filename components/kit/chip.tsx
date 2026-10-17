import { cn } from "cn";

type Tone = "neutral" | "primary" | "good" | "track";

const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary-ink",
  good: "bg-good-soft text-good",
  track: "bg-track-soft text-track",
};

/** A small pill label (Coach's .chip). `caps` gives the uppercase NEW / ASK style. */
export function Chip({
  tone = "neutral",
  caps = false,
  className,
  children,
  title,
}: {
  tone?: Tone;
  caps?: boolean;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold whitespace-nowrap",
        caps && "text-[0.69rem] tracking-[0.04em] uppercase",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
