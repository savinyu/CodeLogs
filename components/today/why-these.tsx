import Link from "next/link";
import { Chip } from "@/components/kit/chip";
import { Meter } from "@/components/kit/meter";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { WEAK_BELOW } from "@/lib/topics/scoring";
import type { TopicPicks } from "@/lib/topics/recommend";
import { PANEL_LINK } from "./this-week";

/** Coverage of each practice topic, which is why those picks were chosen. */
export function WhyThese({ topics }: { topics: TopicPicks[] }) {
  return (
    <Panel aria-labelledby="why-these">
      <PanelHeader
        title="Why these"
        titleId="why-these"
        info={`Coverage is problems solved divided by what is expected at your level. Below ${Math.round(WEAK_BELOW * 100)}% counts as weak, so these three come first.`}
        action={
          <Link href="/topics" className={PANEL_LINK}>
            Topics →
          </Link>
        }
      />
      <div className="grid gap-[18px]">
        {topics.map((t) => {
          const pct = `${Math.round(t.coverage * 100)}%`;
          return (
            <Meter
              key={t.slug}
              name={t.name}
              href={`/topics?topic=${t.slug}`}
              chip={<Chip tone="primary">{pct}</Chip>}
              value={t.coverage}
              tone="weak"
              label={`${t.name} coverage ${pct}`}
              sub={`${Math.round(t.solved)} solved · ~${Math.round(t.expected)} expected${t.focus ? ` · focus: ${t.focus.name}` : ""}`}
            />
          );
        })}
      </div>
    </Panel>
  );
}
