// providers/cache.js
// Tiny TTL cache with two properties that matter for RPC polling:
//  1. In-flight dedupe: N concurrent callers for the same key share ONE request.
//  2. Stale-on-error: if a refresh fails (e.g. public node throttles us),
//     serve the last good value flagged `stale` instead of blanking the UI.
export class TtlCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.entries = new Map(); // key -> { value, expiresAt, fetchedAt }
    this.inflight = new Map(); // key -> Promise
  }

  async get(key, loader) {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return { value: hit.value, fetchedAt: hit.fetchedAt, stale: false, cached: true };
    }
    if (this.inflight.has(key)) return this.inflight.get(key);

    const p = (async () => {
      try {
        const value = await loader();
        const fetchedAt = Date.now();
        this.entries.set(key, { value, fetchedAt, expiresAt: fetchedAt + this.ttlMs });
        return { value, fetchedAt, stale: false, cached: false };
      } catch (err) {
        if (hit) return { value: hit.value, fetchedAt: hit.fetchedAt, stale: true, cached: true, error: err };
        throw err;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, p);
    return p;
  }

  invalidate(key) {
    if (key === undefined) this.entries.clear();
    else this.entries.delete(key);
  }
}
