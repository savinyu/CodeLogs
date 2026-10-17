import { cn } from "cn";
import type { PlatformId } from "@/lib/adapters/types";

const COLOR: Record<PlatformId, string> = {
  codeforces: "bg-platform-codeforces",
  atcoder: "bg-platform-atcoder",
  leetcode: "bg-platform-leetcode",
};

/** A small platform-coloured dot (Coach's .dot). Pass `title` to expose it to screen readers. */
export function PlatformDot({
  platform,
  className,
  title,
}: {
  platform: PlatformId;
  className?: string;
  title?: string;
}) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn("inline-block size-2.5 shrink-0 rounded-full", COLOR[platform], className)}
    />
  );
}
