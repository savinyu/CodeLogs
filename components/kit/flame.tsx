import { cn } from "cn";

/**
 * LeetCode-style streak flame. Lit (rose) once today has activity; grey while the streak still
 * waits on today. Decorative: the caller labels the streak.
 */
export function Flame({
  size = 22,
  lit,
  className,
}: {
  size?: number;
  lit: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path
        d="M16 2c1 5 7 8 7 15a7 7 0 0 1-14 0c0-3 1.5-5 3-6.5.3 2 1 3 2.2 3.5C14 9 14 5 16 2Z"
        className={lit ? "fill-streak" : "fill-muted-foreground"}
      />
      <path
        d="M16 17c2 2 4 3 4 6a4 4 0 0 1-8 0c0-2 1-3 2-4 .5 1 1 1.5 2 1.5-.2-1.5-.2-2.5 0-3.5Z"
        className={lit ? "fill-primary-soft" : "fill-muted"}
      />
    </svg>
  );
}
