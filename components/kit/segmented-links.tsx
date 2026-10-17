import Link from "next/link";
import { cn } from "cn";

/** Pill links where one is active (Coach's .seg). For filters that live in the URL. */
export function SegmentedLinks({
  label,
  items,
  onCard = false,
  className,
}: {
  label: string;
  items: { href: string; label: React.ReactNode; active: boolean }[];
  /** True inside a Panel, where inactive pills use the raised surface. */
  onCard?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-[0.906rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            item.active
              ? "bg-foreground text-background"
              : cn("text-muted-foreground hover:bg-muted", onCard ? "bg-raised" : "bg-card"),
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
