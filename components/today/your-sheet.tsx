import Link from "next/link";
import { Chip } from "@/components/kit/chip";
import { Meter } from "@/components/kit/meter";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { sectionsTraining, type SectionProgress, type SheetProgress } from "@/lib/sheets";
import type { MacroSlug } from "@/lib/topics/taxonomy";
import { PANEL_LINK } from "./this-week";

const unsolved = (s: SectionProgress) => s.problems.filter((p) => p.status === null && !p.premium);

/** The section to work on next: one that trains the weakest topic, else the first with problems left. */
function nextSection(sheet: SheetProgress, weakest: MacroSlug | null) {
  const training = weakest
    ? sectionsTraining([sheet], weakest).find(({ section }) => unsolved(section).length > 0)
    : undefined;
  if (training) return { section: training.section, forWeakest: true };
  const section = sheet.sections.find((s) => unsolved(s).length > 0);
  return section ? { section, forWeakest: false } : null;
}

const link = "font-semibold text-primary-ink underline-offset-2 hover:underline";

/** The first followed sheet: progress and the next two problems for the weakest topic. */
export function YourSheet({
  sheet,
  weakest,
  hasLeetcode,
}: {
  /** Progress through the first followed sheet; null when no sheet is followed. */
  sheet: SheetProgress | null;
  weakest: MacroSlug | null;
  hasLeetcode: boolean;
}) {
  const next = sheet && hasLeetcode ? nextSection(sheet, weakest) : null;
  return (
    <Panel aria-labelledby="your-sheet">
      <PanelHeader
        title="Your sheet"
        titleId="your-sheet"
        action={
          <Link href="/sheets" className={PANEL_LINK}>
            Open →
          </Link>
        }
      />
      {!sheet ? (
        <p className="text-muted-foreground">
          You are not following a sheet.{" "}
          <Link href="/sheets" className={link}>
            Follow one
          </Link>{" "}
          to see what to solve next.
        </p>
      ) : !hasLeetcode ? (
        <p className="text-muted-foreground">
          Sheets track LeetCode problems.{" "}
          <Link href="/connect" className={link}>
            Connect LeetCode
          </Link>{" "}
          to see your progress.
        </p>
      ) : (
        <>
          <Meter
            name={sheet.name}
            chip={
              <Chip>
                {sheet.solved} of {sheet.total}
              </Chip>
            }
            value={sheet.total ? sheet.solved / sheet.total : 0}
            tone="neutral"
            label={`${sheet.name}: ${sheet.solved} of ${sheet.total} solved`}
          />
          {next ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Next in <b className="text-foreground">{next.section.name}</b>
                {next.forWeakest ? " · your weakest topic" : ""}
              </p>
              <ul className="mt-3 grid gap-2">
                {unsolved(next.section)
                  .slice(0, 2)
                  .map((p) => (
                    <li
                      key={p.slug}
                      className="flex items-center gap-2.5 rounded-row bg-raised px-3.5 py-2.5"
                    >
                      <PlatformDot platform="leetcode" />
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere] hover:underline"
                      >
                        {p.title}
                      </a>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nothing left on this sheet.</p>
          )}
        </>
      )}
    </Panel>
  );
}
