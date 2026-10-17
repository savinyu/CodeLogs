import { cn } from "cn";
import { InfoTip } from "./info-tip";

/** A card surface (Coach's .card, .card.big). */
export function Panel({
  size = "md",
  as: Tag = "section",
  className,
  children,
  ...rest
}: {
  size?: "md" | "lg";
  as?: "section" | "div";
} & Omit<React.ComponentProps<"section">, "ref">) {
  return (
    <Tag
      {...rest}
      className={cn(
        "min-w-0 bg-card",
        size === "lg" ? "rounded-card-lg p-5 min-[560px]:p-7" : "rounded-card p-5 min-[560px]:p-6",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** A panel's title row (Coach's .card-head): title and optional info tip left, action right. */
export function PanelHeader({
  title,
  titleId,
  info,
  action,
  align = "baseline",
  className,
  children,
}: {
  title: React.ReactNode;
  titleId?: string;
  /** Explanation shown in an info tip beside the title. */
  info?: React.ReactNode;
  action?: React.ReactNode;
  /** "center" for a tall action, such as a ring, beside the title. */
  align?: "baseline" | "center";
  className?: string;
  /** Sub line under the title row. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <div
        className={cn(
          "flex flex-wrap justify-between gap-3",
          align === "center" ? "items-center" : "items-baseline",
        )}
      >
        <div className="flex items-center gap-2">
          <h2
            id={titleId}
            className="font-display text-2xl leading-tight font-semibold tracking-[-0.01em] text-balance"
          >
            {title}
          </h2>
          {info ? <InfoTip label="More info">{info}</InfoTip> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-1 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
