// Pure: a short "5 min ago" style label. Dates older than a month fall back to "3 Sep 2026".

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatRelative(iso: string | null, now: number): string {
  if (!iso) return "date unknown";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "date unknown";
  const seconds = Math.floor((now - t) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 31) return `${days} days ago`;
  return DATE.format(t);
}
