import { cn } from "cn";

/**
 * The grid that lays out StatTiles (Coach's .tiles). auto-fill keeps the empty tracks, so two or
 * three tiles stay a quarter of the row wide instead of stretching across it.
 */
export function StatTiles({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3.5">{children}</div>
  );
}

/** A headline number with a label and sub line (Coach's .tile-s, .tile-s.main). */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
  size = "default",
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "primary";
  /** "lg" for the headline tile of a row, such as Progress's total. */
  size?: "default" | "lg";
  /** After the sub line, such as a chip row. */
  children?: React.ReactNode;
}) {
  const primary = tone === "primary";
  const lg = size === "lg";
  return (
    <div
      className={cn(
        "grid min-w-0 gap-2 rounded-card p-5",
        primary ? "bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold",
          lg ? "text-lg" : "text-[0.9375rem]",
        )}
      >
        {label}
      </div>
      <div className={cn("font-display leading-none font-bold", lg ? "text-6xl" : "text-5xl")}>
        {value}
      </div>
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
