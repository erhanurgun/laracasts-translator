/**
 * İç içe shadow DOM'larda BFS ile element arar (maks 5 seviye).
 * Mux Player gibi çok katmanlı web component'ler için gerekli.
 *
 * v0.5.1+: Host bazlı TTL cache eklendi. Aynı host+selector için kısa süre
 * içinde tekrarlı çağrılar full BFS yerine cache'ten döner. `isConnected: false`
 * veya `host.shadowRoot` artık erişilmiyorsa cache invalidate olur ve yeniden
 * BFS koşulur. `invalidate(host)` API'si ile manuel olarak da temizlenebilir.
 *
 * Cache çoğunlukla shadow DOM polling sırasında (`findVideoInterval`,
 * `videoCheckInterval`) tekrarlı çağrıları absorbe eder.
 */
const LCTDeepQuery = (() => {
  const DEFAULT_MAX_DEPTH = 5;
  const DEFAULT_TTL_MS = 1500;

  // host -> { [selector]: { el, expiry } }
  // Map (WeakMap değil) çünkü manuel invalidate ve test introspection
  // gerekiyor. Host instance'ları SPA'de kısa ömürlü; cleanup zamanında
  // invalidate çağrılır.
  const cache = new Map();
  let ttlMs = DEFAULT_TTL_MS;

  function readCache(host, selector) {
    const bucket = cache.get(host);
    if (!bucket) return null;
    const entry = bucket[selector];
    if (!entry) return null;
    if (entry.expiry <= Date.now()) return null;
    if (!entry.el || typeof entry.el.isConnected === 'boolean' ? !entry.el.isConnected : false) return null;
    return entry.el;
  }

  function writeCache(host, selector, el) {
    if (!host || !el) return;
    let bucket = cache.get(host);
    if (!bucket) {
      bucket = {};
      cache.set(host, bucket);
    }
    bucket[selector] = { el, expiry: Date.now() + ttlMs };
  }

  function find(host, selector, maxDepth) {
    if (!host || typeof host.shadowRoot === 'undefined') return null;
    const depth = typeof maxDepth === 'number' ? maxDepth : DEFAULT_MAX_DEPTH;

    const cached = readCache(host, selector);
    if (cached) return cached;

    const roots = [];
    if (host.shadowRoot) roots.push(host.shadowRoot);

    for (let d = 0; d < depth && roots.length > 0; d++) {
      const nextRoots = [];
      for (const root of roots) {
        const found = root.querySelector(selector);
        if (found) {
          writeCache(host, selector, found);
          return found;
        }
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) nextRoots.push(el.shadowRoot);
        }
      }
      roots.length = 0;
      roots.push(...nextRoots);
    }
    return null;
  }

  function invalidate(host) {
    if (host === undefined) {
      cache.clear();
      return;
    }
    cache.delete(host);
  }

  function setTtl(ms) {
    if (typeof ms === 'number' && ms >= 0) ttlMs = ms;
  }

  function getTtl() { return ttlMs; }

  return Object.freeze({
    DEFAULT_MAX_DEPTH,
    DEFAULT_TTL_MS,
    find,
    invalidate,
    setTtl,
    getTtl
  });
})();

if (typeof self !== 'undefined') {
  self.LCTDeepQuery = LCTDeepQuery;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTDeepQuery };
}
