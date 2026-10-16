import Link from "next/link";
import { ProgressBar } from "@/components/sheets/progress-bar";
import { allSheetProgress } from "@/lib/sheets";
import { getLeetcodeSolvedSlugs } from "@/lib/sheets/queries";

export async function SheetsSummary({ userId }: { userId: string }) {
  const { slugs } = await getLeetcodeSolvedSlugs(userId);
  const sheets = allSheetProgress(slugs);
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {sheets.map((s) => (
          <li key={s.id}>
            <Link
              href={`/sheets?sheet=${s.id}`}
              className="flex flex-col gap-1.5 rounded-lg outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium">{s.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {s.solved} / {s.total}
                </span>
              </span>
              <ProgressBar value={s.solved} max={s.total} label={`${s.name} progress`} />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/sheets"
        className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Open sheets
      </Link>
    </div>
  );
}
