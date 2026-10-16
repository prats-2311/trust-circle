// The one place dates and times are formatted: en-US, in the viewer's time zone.
const toDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

// Newer ICU versions put a narrow no-break space before AM/PM; keep a plain space.
const plain = (s: string) => s.replace(/[  ]/g, " ");

export function formatDay(d: Date | string): string {
  return plain(toDate(d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }));
}

export function formatTime(d: Date | string): string {
  return plain(toDate(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
}

export function formatDayTime(d: Date | string): string {
  return `${formatDay(d)} at ${formatTime(d)}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function formatWhen(d: Date | string, now: Date = new Date()): string {
  const date = toDate(d);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (days === 0) return `Today at ${formatTime(date)}`;
  if (days === 1) return `Yesterday at ${formatTime(date)}`;
  return formatDayTime(date);
}

// "Oct 16" for tight spaces such as table columns and chart axes.
export function formatShortDay(d: Date | string, timeZone?: string): string {
  return toDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
}
