import { cn } from "cn";

/** A page's title and one-line description (Coach's .page-head). */
export function PageHead({
  title,
  description,
  id,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** For aria-labelledby on the page's section. */
  id?: string;
  className?: string;
  /** Extra content under the description, such as a chip row. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mt-5 mb-7 grid gap-1.5", className)}>
      <h1
        id={id}
        className="font-display text-[clamp(2.125rem,5vw,3rem)] leading-[1.05] font-bold tracking-[-0.02em]"
      >
        {title}
      </h1>
      {description && <p className="max-w-[68ch] text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}
