import { cn } from "cn";

/** The grid that lays out StatTiles (Coach's .tiles). */
export function StatTiles({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3.5">{children}</div>
  );
}

/** A headline number with a label and sub line (Coach's .tile-s, .tile-s.main). */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "primary";
  /** After the sub line, such as a chip row. */
  children?: React.ReactNode;
}) {
  const primary = tone === "primary";
  return (
    <div
      className={cn(
        "grid min-w-0 gap-2 rounded-card p-5",
        primary ? "bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] font-semibold">
        {label}
      </div>
      <div className="font-display text-5xl leading-none font-bold">{value}</div>
      {sub ? (
        <div
          className={cn(
            "text-sm",
            primary ? "text-primary-foreground/85" : "text-muted-foreground",
          )}
        >
          {sub}
        </div>
      ) : null}
      {children}
    </div>
  );
}
