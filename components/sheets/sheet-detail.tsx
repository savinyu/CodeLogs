import Link from "next/link";
import { Note } from "@/components/kit/note";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { Ring } from "@/components/kit/ring";
import { SegmentedLinks } from "@/components/kit/segmented-links";
import { SheetSection } from "@/components/sheets/sheet-section";
import type { SheetProgress } from "@/lib/sheets";
import { topicName, type MacroSlug } from "@/lib/topics/taxonomy";

/** The selected sheet: overall ring, a section filter, and every section. */
export function SheetDetail({
  sheet,
  weakSlugs,
  onlyWeak,
  historyComplete,
}: {
  sheet: SheetProgress;
  weakSlugs: ReadonlySet<MacroSlug>;
  onlyWeak: boolean;
  /** null without a LeetCode account. */
  historyComplete: boolean | null;
}) {
  const weakCount = sheet.sections.filter((s) => weakSlugs.has(s.topic)).length;
  const shown = onlyWeak ? sheet.sections.filter((s) => weakSlugs.has(s.topic)) : sheet.sections;
  const firstOpen = shown.find((s) => s.problems.some((p) => p.status !== "synced"));
  const pct = sheet.total > 0 ? sheet.solved / sheet.total : 0;
  const base = `/sheets?sheet=${sheet.id}`;

  return (
    <Panel size="lg" aria-labelledby="sheet-detail-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Ring
            value={pct}
            size={72}
            stroke={9}
            tone="foreground"
            label={`${sheet.name}: ${sheet.solved} of ${sheet.total} solved`}
          >
            <span className="text-lg">{Math.round(pct * 100)}%</span>
          </Ring>
          <PanelHeader className="mb-0" title={sheet.name} titleId="sheet-detail-title">
            {sheet.solved} solved · {sheet.total - sheet.solved} left · {weakCount}{" "}
            {weakCount === 1 ? "section trains" : "sections train"} your weak topics
          </PanelHeader>
        </div>
        <SegmentedLinks
          label="Filter sections"
          onCard
          items={[
            { href: base, label: `All sections (${sheet.sections.length})`, active: !onlyWeak },
            {
              href: `${base}&sections=weak`,
              label: `Weak topics (${weakCount})`,
              active: onlyWeak,
            },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <p className="py-3 text-muted-foreground">
          None of this sheet&rsquo;s sections train a weak topic right now.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {shown.map((section) => (
            <SheetSection
              key={section.name}
              section={section}
              topicName={topicName(section.topic)}
              weak={weakSlugs.has(section.topic)}
              defaultOpen={section === firstOpen}
            />
          ))}
        </ul>
      )}

      <Note className="mt-5" icon={<PlatformDot platform="leetcode" className="mt-2" />}>
        {historyComplete === null ? (
          <>
            <b>Connect LeetCode to tick sheets from your solves.</b>{" "}
            <Link href="/connect" className="underline underline-offset-4">
              Add your handle on the Connect page.
            </Link>{" "}
            Until then, tick problems by hand with &ldquo;Solved it&rdquo;.
          </>
        ) : historyComplete === false ? (
          <>
            <b>Ticks come from synced solves.</b> LeetCode only shares your latest 20, so older
            solves show as unsolved until you import your full history (
            <Link href="/connect" className="underline underline-offset-4">
              Connect page
            </Link>{" "}
            or the browser extension). Until then, tick them with &ldquo;Solved it&rdquo;.
          </>
        ) : (
          <>
            <b>Ticks come from synced solves.</b> Anything you solved elsewhere can be ticked with
            &ldquo;Solved it&rdquo;.
          </>
        )}{" "}
        Sheets stay private: they are not on your public profile.
      </Note>
      <p className="mt-3 text-sm text-muted-foreground">
        Problem list from{" "}
        <a
          href={sheet.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          {sheet.source.label}
        </a>
        {sheet.source.license ? ` (${sheet.source.license}).` : "."}
      </p>
    </Panel>
  );
}
