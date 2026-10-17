"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { TopicView } from "@/lib/topics/view";
import { TopicMap } from "./topic-map";

const ICON_BUTTON =
  "inline-grid size-9 shrink-0 place-items-center rounded-full bg-raised text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * The owner map plus its right-hand drawer. The drawer content is rendered on the server
 * (`details`, by slug); this component only holds the selection, the <dialog> and the URL.
 */
export function TopicsExplorer({
  topics,
  details,
  initialTopic,
}: {
  topics: TopicView[];
  details: Record<string, React.ReactNode>;
  initialTopic: string | null;
}) {
  // Prev/next walk the map order: biggest tile first.
  const order: string[] = [...topics].sort((a, b) => b.expected - a.expected).map((t) => t.slug);
  const valid = (slug: string | null) => (slug && order.includes(slug) ? slug : null);
  const [selected, setSelected] = useState<string | null>(() => valid(initialTopic));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(null);

  const select = useCallback((slug: string | null) => setSelected(slug), []);

  // Open the dialog and keep ?topic= in sync, without a server round trip.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected) {
      lastRef.current = selected;
      if (!dialog.open) dialog.showModal();
      titleRef.current?.focus({ preventScroll: true });
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      const url = new URL(window.location.href);
      url.searchParams.set("topic", selected);
      window.history.replaceState(window.history.state, "", url);
    } else {
      if (dialog.open) dialog.close();
      const url = new URL(window.location.href);
      if (url.searchParams.has("topic")) {
        url.searchParams.delete("topic");
        window.history.replaceState(window.history.state, "", url);
      }
    }
  }, [selected]);

  function onClose() {
    // Esc and the close button both end up here.
    const slug = lastRef.current;
    setSelected(null);
    if (slug) {
      document
        .querySelector<HTMLElement>(`[data-topic="${CSS.escape(slug)}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  function step(dir: 1 | -1) {
    if (!selected) return;
    const i = order.indexOf(selected);
    select(order[(i + dir + order.length) % order.length] ?? null);
  }

  const topic = topics.find((t) => t.slug === selected);
  const position = selected ? order.indexOf(selected) + 1 : 0;

  return (
    <>
      <TopicMap topics={topics} mode="owner" selected={selected} onSelect={select} />
      <dialog
        ref={dialogRef}
        aria-labelledby="topic-drawer-title"
        onClose={onClose}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close(); // backdrop
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 hidden h-dvh max-h-dvh w-[min(600px,100vw)] max-w-[100vw] flex-col border-0 bg-card p-0 text-foreground shadow-pop backdrop:bg-foreground/40 open:flex open:animate-in open:duration-200 open:fade-in-0 open:slide-in-from-right-10 motion-reduce:animate-none"
      >
        <div className="flex flex-none items-center gap-2 border-b border-border py-3.5 pr-5 pl-6 max-[560px]:pl-4">
          <h2
            id="topic-drawer-title"
            ref={titleRef}
            tabIndex={-1}
            className="mr-auto min-w-0 font-display text-[1.625rem] leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] outline-none"
          >
            {topic?.name}
          </h2>
          <span className="text-[0.81rem] font-semibold whitespace-nowrap text-muted-foreground">
            {position} / {order.length}
          </span>
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label="Previous topic"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label="Next topic"
            onClick={() => step(1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label="Close (Esc)"
            onClick={() => dialogRef.current?.close()}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-6 pt-5 pb-8 max-[560px]:px-4"
          onClick={(e) => {
            // In-drawer links to another topic switch topics instead of reloading the page.
            const link = (e.target as HTMLElement).closest<HTMLElement>("[data-topic-link]");
            const slug = valid(link?.dataset.topicLink ?? null);
            if (slug) {
              e.preventDefault();
              select(slug);
            }
          }}
        >
          {selected ? details[selected] : null}
        </div>
      </dialog>
    </>
  );
}
