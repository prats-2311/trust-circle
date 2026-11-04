/** A rolling-window limiter kept in this process only (one instance); a restart resets it, which is fine for a demo guard. */
export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const taken = new Map<string, number[]>();
  return {
    take(key: string): boolean {
      const since = now() - opts.windowMs;
      const recent = (taken.get(key) ?? []).filter((t) => t > since);
      if (recent.length >= opts.limit) {
        taken.set(key, recent);
        return false;
      }
      taken.set(key, [...recent, now()]);
      return true;
    },
  };
}

/** Who a request counts against: the first forwarded address when there is one, otherwise the signed-in user. */
export function clientKey(req: Request, userId: string): string {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first ? first : `user:${userId}`;
}
