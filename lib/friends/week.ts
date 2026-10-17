const DAY_MS = 86_400_000;

/** Monday 00:00 UTC of the week containing `now`. */
export function weekStart(now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(midnight - sinceMonday * DAY_MS);
}

const fmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function label(date: Date): string {
  // en-GB gives "Mon 13 Oct" or "Mon, 13 Oct" depending on the runtime.
  return fmt.format(date).replace(",", "");
}

/** "Mon 13 Oct to Sun 19 Oct" */
export function weekLabel(now: Date): string {
  const start = weekStart(now);
  return `${label(start)} to ${label(new Date(start.getTime() + 6 * DAY_MS))}`;
}
