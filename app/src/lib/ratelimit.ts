/**
 * Token-bucket rate limiter (per process).
 *
 * Used to protect message sending and OTP-adjacent endpoints from bursts.
 * A single instance is authoritative; for horizontal scaling move the bucket
 * into Redis with the same interface.
 */

const buckets = new Map<string, { tokens: number; last: number }>();

export function take(key: string, capacity = 20, refillPerSecond = 2): boolean {
  const nowMs = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, last: nowMs };
  const elapsed = (nowMs - bucket.last) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
  bucket.last = nowMs;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

// Keep the map from growing without bound in long-lived processes.
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [key, bucket] of buckets) {
    if (bucket.last < cutoff) buckets.delete(key);
  }
}, 60_000).unref?.();
