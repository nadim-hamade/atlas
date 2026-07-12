/**
 * In-memory rate limiting. State is per server instance and resets on cold
 * start, so this is a first line of defense against casual abuse, not a
 * guarantee — move to a shared store (e.g. Postgres) if that ever matters.
 */

interface Window {
  count: number;
  startedAt: number;
}

const MAX_TRACKED_KEYS = 5000;

const windows = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  /** seconds until the window resets; 0 when ok */
  retryAfterS: number;
}

/** Fixed-window counter: allow `limit` hits per `windowMs` for this key. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Keep the map bounded if someone rotates keys (e.g. spoofed IPs).
  if (windows.size > MAX_TRACKED_KEYS) {
    for (const [k, w] of windows) {
      if (now - w.startedAt >= windowMs) windows.delete(k);
    }
    if (windows.size > MAX_TRACKED_KEYS) windows.clear();
  }

  const w = windows.get(key);
  if (!w || now - w.startedAt >= windowMs) {
    windows.set(key, { count: 1, startedAt: now });
    return { ok: true, retryAfterS: 0 };
  }

  w.count += 1;
  if (w.count > limit) {
    return { ok: false, retryAfterS: Math.max(1, Math.ceil((w.startedAt + windowMs - now) / 1000)) };
  }
  return { ok: true, retryAfterS: 0 };
}

let activeRuns = 0;

/**
 * Global concurrency gate for expensive work. Returns a release function, or
 * null when all slots are taken. The release is idempotent.
 */
export function tryAcquireRun(maxConcurrent: number): (() => void) | null {
  if (activeRuns >= maxConcurrent) return null;
  activeRuns += 1;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      activeRuns -= 1;
    }
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
