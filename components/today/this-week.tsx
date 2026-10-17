import Link from "next/link";
import { Panel, PanelHeader } from "@/components/kit/panel";
import type { WeekDay } from "@/lib/today/week";
import { cn } from "cn";

export const PANEL_LINK = "text-[0.9375rem] font-semibold text-muted-foreground hover:underline";

/** The last seven days as small columns, today highlighted. */
export function ThisWeek({ week }: { week: WeekDay[] }) {
  const total = week.reduce((n, d) => n + d.total, 0);
  const max = Math.max(...week.map((d) => d.total), 1);
  return (
    <Panel aria-labelledby="this-week">
      <PanelHeader
        title="This week"
        titleId="this-week"
        action={
          <Link href="/progress" className={PANEL_LINK}>
            Progress →
          </Link>
        }
      />
      <div className="grid grid-cols-7 gap-2">
        {week.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.total} ${d.total === 1 ? "solve" : "solves"}`}
            aria-current={d.isToday ? "date" : undefined}
            className={cn(
              "grid justify-items-center gap-1 rounded-row px-0.5 pt-2.5 pb-2",
              d.isToday ? "bg-primary-soft" : "bg-raised",
            )}
          >
            <span className="text-[0.78rem] font-semibold text-muted-foreground">{d.weekday}</span>
            <span className="flex h-[38px] w-full max-w-5 items-end" aria-hidden="true">
              <i
                className={cn(
                  "block min-h-[3px] w-full rounded-md",
                  d.total ? "bg-heat-3" : "bg-heat-0",
                )}
                style={{ height: `${d.total ? Math.max(12, (d.total / max) * 100) : 8}%` }}
              />
            </span>
            <span className="font-display text-xl leading-none font-bold">{d.total}</span>
          </div>
        ))}
      </div>
      <p className="mt-3.5 font-semibold">
        {total} {total === 1 ? "solve" : "solves"} this week
      </p>
    </Panel>
  );
}
