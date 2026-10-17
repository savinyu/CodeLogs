import { Bar } from "@/components/kit/bar";
import { Chip } from "@/components/kit/chip";
import { Disclosure } from "@/components/kit/disclosure";
import { TickRow } from "@/components/sheets/tick-row";
import type { SectionProgress } from "@/lib/sheets";

/** One sheet section: progress in the summary, the problems still to do in the body. */
export function SheetSection({
  section,
  topicName,
  weak,
  defaultOpen,
}: {
  section: SectionProgress;
  topicName: string;
  weak: boolean;
  defaultOpen: boolean;
}) {
  const { solved, total } = section;
  const done = total > 0 && solved === total;
  // Synced solves aren't listed; ticked ones stay so they can be undone.
  const rows = section.problems.filter((p) => p.status !== "synced");

  return (
    <li>
      <Disclosure
        defaultOpen={defaultOpen}
        summaryClassName="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 gap-y-2 min-[900px]:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_150px] min-[900px]:gap-x-4"
        summary={
          <>
            <span className="col-start-2 flex flex-wrap items-center gap-2.5 font-semibold">
              {section.name}
              <Chip tone={weak ? "primary" : "neutral"}>{topicName}</Chip>
            </span>
            <div className="col-span-3 col-start-1 row-start-2 min-[900px]:col-span-1 min-[900px]:col-start-3 min-[900px]:row-start-1">
              <Bar
                value={total > 0 ? solved / total : 0}
                tone={done ? "strong" : "neutral"}
                size="md"
                label={`${section.name}: ${solved} of ${total} solved`}
              />
            </div>
            <span className="col-start-3 flex items-center justify-end gap-2 min-[900px]:col-start-4 text-[0.906rem] text-muted-foreground tabular-nums">
              {solved} / {total}
              {done ? <Chip tone="good">Done</Chip> : null}
            </span>
          </>
        }
      >
        <div className="grid gap-1 pl-8 max-[560px]:pl-0">
          {rows.length === 0 ? (
            <p className="py-2 text-[0.906rem] text-muted-foreground">All solved.</p>
          ) : (
            rows.map((p) => <TickRow key={p.slug} problem={p} ticked={p.status === "ticked"} />)
          )}
          {section.offPlatform.map((o) => (
            <div
              key={o.url}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 shadow-[0_-1px_0_var(--border)]"
            >
              <span className="size-2.5 shrink-0" aria-hidden="true" />
              <a
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-40 flex-1 font-semibold [overflow-wrap:anywhere] hover:underline"
              >
                {o.title}
              </a>
              <Chip title="Not counted: only LeetCode problems can be matched">{o.site}</Chip>
            </div>
          ))}
        </div>
      </Disclosure>
    </li>
  );
}
