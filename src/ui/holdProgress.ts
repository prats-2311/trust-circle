export function holdProgress(a: { authorisedAt: string | null; coolingOffUntil: string | null; now: Date }) {
  if (!a.authorisedAt || !a.coolingOffUntil) return { fractionUsed: 0, msLeft: 0, releaseAt: null };
  const start = new Date(a.authorisedAt).getTime();
  const end = new Date(a.coolingOffUntil).getTime();
  const span = Math.max(1, end - start);
  const used = Math.min(span, Math.max(0, a.now.getTime() - start));
  return { fractionUsed: used / span, msLeft: Math.max(0, end - a.now.getTime()), releaseAt: new Date(end) };
}

export function timeLeftText(ms: number): string {
  if (ms <= 0) return "Ready to release";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
}
