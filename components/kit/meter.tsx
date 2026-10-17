import Link from "next/link";
import { Bar } from "./bar";

/** A named progress meter (Coach's .meter): name and chip, a bar, then a muted sub line. */
export function Meter({
  name,
  href,
  chip,
  value,
  tone,
  label,
  sub,
}: {
  name: React.ReactNode;
  href?: string;
  chip?: React.ReactNode;
  value: number;
  tone?: React.ComponentProps<typeof Bar>["tone"];
  /** Accessible description of the bar. */
  label: string;
  sub?: React.ReactNode;
}) {
  const nameClass = "text-[1.0625rem] font-semibold";
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        {href ? (
          <Link href={href} className={`${nameClass} hover:underline`}>
            {name}
          </Link>
        ) : (
          <span className={nameClass}>{name}</span>
        )}
        {chip}
      </div>
      <Bar value={value} tone={tone} label={label} />
      {sub ? <div className="text-sm text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
