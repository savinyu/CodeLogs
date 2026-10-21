import { cn } from "cn";
import { LEVEL_HEADROOM, WEAK_BELOW } from "@/lib/topics/scoring";
import { squarify } from "@/lib/topics/treemap";
import { formatPct, publicStep, type TopicView } from "@/lib/topics/view";

type Mode = "owner" | "public";

// Static maps so Tailwind sees every class.
const COV: Record<number, string> = {
  1: "bg-cov-1 text-cov-1-fg",
  2: "bg-cov-2 text-cov-2-fg",
  3: "bg-cov-3 text-cov-3-fg",
  4: "bg-cov-4 text-cov-4-fg",
  5: "bg-cov-5 text-cov-5-fg",
};
const PUB: Record<number, string> = {
  1: "bg-pub-1 text-pub-1-fg",
  2: "bg-pub-2 text-pub-2-fg",
  3: "bg-pub-3 text-pub-3-fg",
  4: "bg-pub-4 text-pub-4-fg",
};
const COV_SWATCH: Record<number, string> = {
  1: "bg-cov-1",
  2: "bg-cov-2",
  3: "bg-cov-3",
  4: "bg-cov-4",
  5: "bg-cov-5",
};
const PUB_SWATCH: Record<number, string> = {
  1: "bg-pub-1",
  2: "bg-pub-2",
  3: "bg-pub-3",
  4: "bg-pub-4",
};
// The "Weak" tag is drawn in the tile's own text colour on its background.
const WEAK_TAG: Record<number, string> = {
  1: "bg-cov-1-fg text-cov-1",
  2: "bg-cov-2-fg text-cov-2",
  3: "bg-cov-3-fg text-cov-3",
  4: "bg-cov-4-fg text-cov-4",
  5: "bg-cov-5-fg text-cov-5",
};

const OWNER_HEIGHT = 54;
const PUBLIC_HEIGHT = 40;

const COV_LEGEND = ["Under 50%", "50–80%", "80–100%", "100–120%", "Over 120%"];
const PUB_LEGEND = ["Under 25", "25–44", "45–99", "100 or more"];

/** Legend for the map; the owner one also states the weak threshold and what "expected" means. */
export function MapLegend({ mode }: { mode: Mode }) {
  const labels = mode === "owner" ? COV_LEGEND : PUB_LEGEND;
  const swatch = mode === "owner" ? COV_SWATCH : PUB_SWATCH;
  return (
    <>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[0.84rem] text-muted-foreground">
        {labels.map((label, i) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <i className={cn("inline-block h-3 w-[18px] rounded-sm", swatch[i + 1])} />
            {label}
          </span>
        ))}
        {mode === "owner" ? (
          <span className="ml-auto">Weak = under {formatPct(WEAK_BELOW)}</span>
        ) : null}
      </div>
      {mode === "owner" ? (
        <p className="mt-2.5 max-w-[72ch] text-[0.84rem] text-muted-foreground">
          <b className="font-semibold text-foreground">Expected</b> is how many you&apos;d have
          solved in a topic if your solves followed each platform&apos;s problem mix (on Codeforces,
          problems up to {LEVEL_HEADROOM} above your level, with solves weighted by rating). A
          problem counts toward every topic it&apos;s tagged with, so over 100% just means
          you&apos;ve practised that topic more than its usual share.
        </p>
      ) : null}
    </>
  );
}

/**
 * The topic treemap. Owner: area = expected, colour = coverage, tiles are buttons. Public: area =
 * solved, colour = solves, tiles are list items with no expected or weak values. Under 640px it
 * becomes a stacked list.
 */
export function TopicMap({
  topics,
  mode,
  selected = null,
  onSelect,
}: {
  topics: TopicView[];
  mode: Mode;
  selected?: string | null;
  onSelect?: (slug: string) => void;
}) {
  const owner = mode === "owner";
  const H = owner ? OWNER_HEIGHT : PUBLIC_HEIGHT;
  const rects = squarify(
    topics.map((t) => ({ item: t, value: owner ? t.expected : t.solved })),
    100,
    H,
  );

  return (
    <div
      role={owner ? undefined : "list"}
      aria-label={owner ? undefined : "Problems solved by topic"}
      className={cn(
        "relative max-[640px]:grid max-[640px]:gap-1.5",
        owner
          ? "aspect-[100/54] max-[640px]:aspect-auto"
          : "aspect-[100/40] max-[640px]:aspect-auto",
      )}
    >
      {rects.map(({ item: t, x, y, w, h }) => {
        const small = owner ? w < 16 || (h / H) * 100 < 22 : w < 12 || (h / H) * 100 < 26;
        const weak = owner && t.state === "weak";
        const step = owner ? t.step : publicStep(t.solved);
        const pos = {
          "--x": x.toFixed(2),
          "--y": ((y / H) * 100).toFixed(2),
          "--w": w.toFixed(2),
          "--h": ((h / H) * 100).toFixed(2),
        } as React.CSSProperties;
        const tileClass = cn(
          "group block min-w-0 border-0 bg-transparent p-0 text-left font-[inherit] text-inherit",
          "min-[641px]:absolute min-[641px]:top-[calc(var(--y)*1%)] min-[641px]:left-[calc(var(--x)*1%)] min-[641px]:h-[calc(var(--h)*1%)] min-[641px]:w-[calc(var(--w)*1%)] min-[641px]:p-[3px]",
          owner ? "cursor-pointer outline-none" : "cursor-default",
        );
        const inner = (
          <span
            className={cn(
              "flex h-full flex-col justify-between gap-1 overflow-hidden rounded-[14px] px-3.5 py-3",
              "max-[640px]:min-h-[58px] max-[640px]:flex-row max-[640px]:items-center max-[640px]:gap-2.5",
              small && "min-[641px]:px-2.5 min-[641px]:py-[9px]",
              owner ? COV[step] : PUB[step],
              owner &&
                "group-hover:brightness-95 group-focus-visible:outline-3 group-focus-visible:-outline-offset-3 group-focus-visible:outline-foreground group-aria-pressed:shadow-[inset_0_0_0_3px_var(--foreground)]",
            )}
          >
            <span className="flex items-start justify-between gap-1.5 max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:flex-wrap max-[640px]:items-center max-[640px]:justify-start">
              <span
                className={cn(
                  "text-base leading-tight font-bold [overflow-wrap:anywhere]",
                  small && "min-[641px]:text-[0.78rem]",
                )}
              >
                {t.name}
              </span>
              {weak ? (
                <span
                  className={cn(
                    "flex-none rounded-full px-2 py-0.5 text-[0.66rem] font-bold tracking-[0.05em] uppercase",
                    WEAK_TAG[step],
                  )}
                >
                  Weak
                </span>
              ) : null}
            </span>
            <span className="grid gap-0.5 max-[640px]:justify-items-end">
              <span
                className={cn(
                  "font-display text-[clamp(18px,3vw,38px)] leading-none font-bold",
                  small && "min-[641px]:text-[18px]",
                )}
              >
                {owner ? formatPct(t.coverage) : t.solved}
              </span>
              <span className={cn("text-[0.81rem] opacity-85", small && "min-[641px]:hidden")}>
                {owner ? `${t.solved} / ~${Math.round(t.expected)}` : "solved"}
              </span>
            </span>
          </span>
        );
        return owner ? (
          <button
            key={t.slug}
            type="button"
            data-topic={t.slug}
            aria-pressed={selected === t.slug}
            aria-label={`${t.name}: ${formatPct(t.coverage)} coverage, ${t.solved} of about ${Math.round(t.expected)} expected${weak ? ", weak" : ""}`}
            onClick={() => onSelect?.(t.slug)}
            style={pos}
            className={tileClass}
          >
            {inner}
          </button>
        ) : (
          <span
            key={t.slug}
            role="listitem"
            aria-label={`${t.name}: ${t.solved} solved`}
            style={pos}
            className={tileClass}
          >
            {inner}
          </span>
        );
      })}
    </div>
  );
}
