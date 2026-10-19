import Link from "next/link";
import { cn } from "cn";
import { Bar } from "@/components/kit/bar";
import { Chip } from "@/components/kit/chip";
import { DifficultyBadge } from "@/components/kit/difficulty-badge";
import { PlatformDot } from "@/components/kit/platform-dot";
import { PLATFORM_META } from "@/lib/platforms";
import { WEAK_BELOW } from "@/lib/topics/scoring";
import type { Recommendation } from "@/lib/topics/recommend";
import { formatPct, type TopicState, type TopicView } from "@/lib/topics/view";

const STATE_CHIP: Record<TopicState, { tone: "primary" | "track" | "good"; label: string }> = {
  weak: { tone: "primary", label: "Weak" },
  ontrack: { tone: "track", label: "On track" },
  strong: { tone: "good", label: "Strong" },
};
const BAR_TONE: Record<TopicState, "weak" | "ontrack" | "strong"> = {
  weak: "weak",
  ontrack: "ontrack",
  strong: "strong",
};
export interface SheetRow {
  key: string;
  label: string;
  solved: number;
  total: number;
}

export interface TopicDetailProps {
  topic: TopicView;
  /** This topic's practice picks, when it is one of today's practice topics. */
  picks: { focusSlug: string | null; problems: Recommendation[] } | null;
  /** The practice topic with the lowest coverage, for the "not a weak topic" line. */
  weakest: { slug: string; name: string } | null;
  /** Sections of the followed sheets that train this topic. */
  sheetRows: SheetRow[];
  /** The sheet the "Open in Sheets" link selects. */
  sheetId: string | null;
  followsSheets: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 grid gap-2.5 border-t border-border pt-4">
      <h3 className="text-[0.9375rem] font-bold tracking-[0.05em] text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The drawer body for one topic. Server-rendered; the explorer swaps it in. */
export function TopicDetail({
  topic,
  picks,
  weakest,
  sheetRows,
  sheetId,
  followsSheets,
}: TopicDetailProps) {
  const chip = STATE_CHIP[topic.state];
  // Sub-topics expecting under one problem are noise, as in the practice focus (scoring.ts).
  const candidates = topic.micros.filter((m) => m.expected >= 1);
  const lowest = (candidates.length > 0 ? candidates : topic.micros).reduce<
    (typeof topic.micros)[number] | null
  >((a, b) => (a === null || b.coverage < a.coverage ? b : a), null);
  const focusSlug = picks ? picks.focusSlug : (lowest?.slug ?? null);
  const focusLabel = picks ? "Focus" : "Lowest";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3.5">
        <span className="font-display text-[4rem] leading-[0.9] font-bold">
          {formatPct(topic.coverage)}
        </span>
        <span className="grid gap-1 pb-1.5">
          <Chip tone={chip.tone} className="justify-self-start">
            {chip.label}
          </Chip>
          <span className="text-muted-foreground">
            {topic.solved} solved · ~{Math.round(topic.expected)} expected
          </span>
        </span>
      </div>
      {topic.platforms.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topic.platforms.map((p) => (
            <Chip key={p.platform}>
              <PlatformDot platform={p.platform} />
              {PLATFORM_META[p.platform].short} {p.solved} of ~{Math.round(p.expected)}
            </Chip>
          ))}
        </div>
      ) : null}
      {topic.state === "weak" ? (
        <p className="mt-3 text-[0.9375rem]">
          Solve about <b>{topic.toLeaveWeak}</b> more to reach {formatPct(WEAK_BELOW)} and leave the
          weak list.
        </p>
      ) : null}

      {topic.micros.length > 0 ? (
        <Section title="Sub-topics">
          {topic.micros.map((m) => {
            const scale = Math.max(m.solved, m.expected) * 1.08 || 1;
            const isFocus = m.slug === focusSlug;
            return (
              <div
                key={m.slug}
                className="grid grid-cols-[minmax(0,1fr)_110px_64px] items-center gap-2.5 text-[0.906rem] max-[560px]:grid-cols-[minmax(0,1fr)_64px]"
              >
                <span className={cn(isFocus && "font-bold")}>
                  {m.name}
                  {isFocus ? (
                    <>
                      {" "}
                      <Chip tone="primary">{focusLabel}</Chip>
                    </>
                  ) : null}
                </span>
                <div className="max-[560px]:order-last max-[560px]:col-span-full">
                  <Bar
                    size="sm"
                    tone={BAR_TONE[m.state]}
                    value={m.solved / scale}
                    marker={m.expected / scale}
                    label={`${m.name}: ${m.solved} solved of about ${Math.round(m.expected)} expected`}
                  />
                </div>
                <span className="text-right text-[0.84rem] text-muted-foreground">
                  {m.solved} / ~{Math.round(m.expected)}
                </span>
              </div>
            );
          })}
        </Section>
      ) : null}

      <Section title="Practice">
        {picks && picks.problems.length > 0 ? (
          <ul className="m-0 grid list-none gap-2 p-0">
            {picks.problems.map((p) => (
              <li
                key={`${p.platform}:${p.externalId}`}
                className="flex flex-wrap items-center gap-2.5 rounded-row bg-raised px-3.5 py-2.5"
              >
                <PlatformDot platform={p.platform} />
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-[150px] flex-1 font-semibold [overflow-wrap:anywhere] hover:underline"
                >
                  {p.title}
                </a>
                {p.difficultyRaw ? (
                  <DifficultyBadge platform={p.platform} raw={p.difficultyRaw} />
                ) : null}
                {p.maybeSolved ? <Chip>may already be solved</Chip> : null}
              </li>
            ))}
          </ul>
        ) : picks ? (
          <p className="text-[0.9375rem] text-muted-foreground">No picks to show right now.</p>
        ) : (
          <p className="text-[0.9375rem] text-muted-foreground">
            Not a weak topic, so no picks today.
            {weakest ? (
              <>
                {" "}
                Your weakest is{" "}
                <Link
                  href={`/topics?topic=${weakest.slug}`}
                  data-topic-link={weakest.slug}
                  className="font-semibold text-primary-ink"
                >
                  {weakest.name}
                </Link>
                .
              </>
            ) : null}
          </p>
        )}
      </Section>

      <Section title="In your sheets">
        {sheetRows.length > 0 ? (
          <>
            <div className="grid gap-2">
              {sheetRows.map((r) => (
                <div
                  key={r.key}
                  className="grid grid-cols-[minmax(0,1fr)_90px_52px] items-center gap-2.5 text-[0.906rem] max-[560px]:grid-cols-[minmax(0,1fr)_64px]"
                >
                  <span>{r.label}</span>
                  <div className="max-[560px]:order-last max-[560px]:col-span-full">
                    <Bar
                      size="sm"
                      tone="neutral"
                      value={r.total ? r.solved / r.total : 0}
                      label={`${r.label}: ${r.solved} of ${r.total} solved`}
                    />
                  </div>
                  <span className="text-right text-[0.84rem] text-muted-foreground">
                    {r.solved} / {r.total}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href={`/sheets${sheetId ? `?sheet=${sheetId}` : ""}`}
              className="text-[0.9375rem] font-semibold text-primary-ink"
            >
              Open in Sheets →
            </Link>
          </>
        ) : (
          <p className="text-[0.9375rem] text-muted-foreground">
            {followsSheets
              ? "No section in the sheets you follow maps to this topic."
              : "You are not following any sheets yet."}{" "}
            <Link href="/sheets" className="font-semibold text-primary-ink">
              Open Sheets →
            </Link>
          </p>
        )}
      </Section>
    </div>
  );
}
