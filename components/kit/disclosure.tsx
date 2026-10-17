import { ChevronRight } from "lucide-react";
import { cn } from "cn";

/** A collapsible row (Coach's details.history, .sec). Callers lay out their own summary. */
export function Disclosure({
  summary,
  children,
  defaultOpen,
  className,
  summaryClassName,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  summaryClassName?: string;
}) {
  return (
    <details open={defaultOpen} className={cn("group rounded-item bg-raised", className)}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-item px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        {summary}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
