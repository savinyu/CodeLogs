import { cn } from "cn";

/** A muted callout (Coach's .note), optionally led by an icon. */
export function Note({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-item bg-muted px-4.5 py-3.5 text-[0.9375rem]",
        className,
      )}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
