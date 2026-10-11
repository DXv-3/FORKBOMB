// Simple in-memory fixed-window rate limiter, keyed by client IP. Zero dependencies.
// Bounded memory: stale windows are pruned and at most `maxKeys` clients are tracked.
"use strict";
class RateLimiter {
  constructor({ limit = 30, windowMs = 60e3, maxKeys = 10000 } = {}) {
    this.limit = limit; this.windowMs = windowMs; this.maxKeys = maxKeys; this.hits = new Map();
  }
  // -> { ok, remaining, retryAfter (seconds) }
  take(key, now = Date.now()) {
    let h = this.hits.get(key);
    if (!h || now - h.start >= this.windowMs) {
      if (!h && this.hits.size >= this.maxKeys) this.prune(now);
      if (!h && this.hits.size >= this.maxKeys) return { ok: false, remaining: 0, retryAfter: Math.ceil(this.windowMs / 1000) };
      h = { start: now, n: 0 }; this.hits.set(key, h);
    }
    h.n++;
    const retryAfter = Math.max(1, Math.ceil((h.start + this.windowMs - now) / 1000));
    return { ok: h.n <= this.limit, remaining: Math.max(0, this.limit - h.n), retryAfter };
  }
  prune(now = Date.now()) { for (const [k, h] of this.hits) if (now - h.start >= this.windowMs) this.hits.delete(k); }
}
module.exports = { RateLimiter };
