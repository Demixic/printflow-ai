/**
 * Fixed-window limiter for failed sign-in attempts. In-memory, so each server
 * instance counts separately; it slows down guessing rather than providing a
 * global guarantee (a shared store such as Redis would be needed for that).
 */
export function createAttemptLimiter({
  maxFailures = 5,
  windowMs = 15 * 60_000,
  now = () => Date.now(),
  maxKeys = 10_000,
} = {}) {
  const failures = new Map<string, { count: number; resetAt: number }>();

  function entry(key: string) {
    const current = failures.get(key);
    if (current && current.resetAt > now()) return current;
    failures.delete(key);
    return null;
  }

  return {
    /** Seconds until the key may try again, or 0 if it isn't blocked. */
    retryAfterSeconds(key: string): number {
      const current = entry(key);
      return current && current.count >= maxFailures ? Math.ceil((current.resetAt - now()) / 1000) : 0;
    },
    recordFailure(key: string) {
      const current = entry(key);
      if (current) current.count += 1;
      else {
        if (failures.size >= maxKeys) failures.delete(failures.keys().next().value as string);
        failures.set(key, { count: 1, resetAt: now() + windowMs });
      }
    },
    reset(key: string) {
      failures.delete(key);
    },
  };
}
