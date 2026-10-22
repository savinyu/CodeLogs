import { Suspense } from "react";
import { ConnectPrompt } from "@/components/kit/connect-prompt";
import { Note } from "@/components/kit/note";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel } from "@/components/kit/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { TopicDetail, type SheetRow } from "@/components/topics/topic-detail";
import { ExpectedNote, MapLegend } from "@/components/topics/topic-map";
import { TopicsExplorer } from "@/components/topics/topics-explorer";
import { getDashboardData } from "@/lib/dashboard/queries";
import { requireUser } from "@/lib/session";
import { SHEETS, sectionsTraining, sheetProgress } from "@/lib/sheets";
import { getSheetState } from "@/lib/sheets/queries";
import { getSolveNext } from "@/lib/topics/recommend";
import { noTopicMapReason, topicViews } from "@/lib/topics/view";

export const metadata = { title: "Topics" };

const DESCRIPTION =
  "Bigger tiles are topics you are expected to have done more of at your level. Colour shows how far along you are. Click a tile for details.";

async function TopicsContent({ searchParams }: Pick<PageProps<"/topics">, "searchParams">) {
  const user = await requireUser();
  const [data, sheets, params] = await Promise.all([
    getDashboardData(user.id),
    getSheetState(user.id),
    searchParams,
  ]);

  if (data.accounts.length === 0) return <ConnectPrompt />;
  if (data.topics.every((t) => t.platforms.length === 0)) {
    return <Note>{noTopicMapReason(data.accounts.map((a) => a.platform))}</Note>;
  }

  const picks = await getSolveNext(user.id, data);
  const picksBySlug = new Map<string, (typeof picks)[number]>(picks.map((p) => [p.slug, p]));
  const weakest = picks[0] ? { slug: picks[0].slug, name: picks[0].name } : null;

  const followedProgress = SHEETS.filter((s) => sheets.followed.includes(s.id)).map((s) =>
    sheetProgress(s, sheets.solvedSlugs, sheets.tickedSlugs),
  );
  const showSheetName = followedProgress.length > 1;

  const topics = topicViews(data.topics);
  const details: Record<string, React.ReactNode> = {};
  for (const topic of topics) {
    const pick = picksBySlug.get(topic.slug);
    const training = sectionsTraining(followedProgress, topic.slug);
    const sheetRows: SheetRow[] = training.map((t) => ({
      key: `${t.sheetId}:${t.section.name}`,
      label: showSheetName ? `${t.sheetName} · ${t.section.name}` : t.section.name,
      solved: t.section.solved,
      total: t.section.total,
    }));
    details[topic.slug] = (
      <TopicDetail
        topic={topic}
        picks={pick ? { focusSlug: pick.focus?.slug ?? null, problems: pick.problems } : null}
        weakest={weakest}
        sheetRows={sheetRows}
        sheetId={training[0]?.sheetId ?? null}
        followsSheets={followedProgress.length > 0}
      />
    );
  }

  const param = params.topic;
  const initialTopic = typeof param === "string" ? param : null;

  return (
    <>
      <Panel size="lg">
        <TopicsExplorer topics={topics} details={details} initialTopic={initialTopic} />
        <MapLegend mode="owner" />
      </Panel>
      <ExpectedNote />
    </>
  );
}

function TopicsSkeleton() {
  return (
    <Skeleton className="aspect-[100/54] w-full rounded-card-lg max-[640px]:aspect-auto max-[640px]:h-96" />
  );
}

export default function TopicsPage(props: PageProps<"/topics">) {
  return (
    <Page>
      <PageHead title="Topics" description={DESCRIPTION} />
      <Suspense fallback={<TopicsSkeleton />}>
        <TopicsContent searchParams={props.searchParams} />
      </Suspense>
    </Page>
  );
}
