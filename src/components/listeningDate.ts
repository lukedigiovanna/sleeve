const listeningDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatListeningDate(date: string): string {
  return listeningDateFormat.format(new Date(date.slice(0, 10) + "T00:00:00Z"));
}
