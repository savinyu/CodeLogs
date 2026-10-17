import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, string> = {
  sm: "size-9",
  md: "size-10",
  lg: "size-[84px]",
  xl: "size-28",
};
// Squircle radius per size: on the root (plus its border overlay) and on the inner image/fallback.
const SQUIRCLE: Record<Size, string> = {
  sm: "rounded-[14px] after:rounded-[14px]",
  md: "rounded-[12px] after:rounded-[12px]",
  lg: "rounded-[28px] after:rounded-[28px]",
  xl: "rounded-[36px] after:rounded-[36px]",
};
const SQUIRCLE_INNER: Record<Size, string> = {
  sm: "rounded-[14px]",
  md: "rounded-[12px]",
  lg: "rounded-[28px]",
  xl: "rounded-[36px]",
};
const FALLBACK_TEXT: Record<Size, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "font-display text-3xl font-bold",
  xl: "font-display text-4xl font-bold",
};

/** First letters of the first two words, uppercased; "?" for an empty name. */
export function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]);
  return letters.join("").toUpperCase() || "?";
}

/** A user's picture, or their initials (Coach's .pav, .pub-avatar). */
export function UserAvatar({
  name,
  image,
  size = "md",
  shape = "circle",
  tone = "default",
  className,
}: {
  name: string;
  image?: string | null;
  size?: Size;
  shape?: "circle" | "squircle";
  tone?: "default" | "primary";
  className?: string;
}) {
  const squircle = shape === "squircle";
  return (
    <Avatar className={cn(SIZE[size], squircle && SQUIRCLE[size], className)}>
      {image ? (
        <AvatarImage src={image} alt="" className={cn(squircle && SQUIRCLE_INNER[size])} />
      ) : null}
      <AvatarFallback
        className={cn(
          FALLBACK_TEXT[size],
          squircle && SQUIRCLE_INNER[size],
          tone === "primary" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
