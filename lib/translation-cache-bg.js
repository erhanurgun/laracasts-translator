/**
 * Background service worker için çeviri cache.
 * get/set/evictOldest. QUOTA hatasında LRU ile %25 temizlik.
 * Fingerprint parametresi set'te zorunlu (Liskov).
 */
const LCTTranslationCacheBg = (() => {
  function getLib(name, fallback = null) {
    return (typeof self !== 'undefined' && self[name]) || fallback;
  }

  function getCacheKeys() {
    const M = getLib('LCTCacheKeys');
    if (!M) throw new Error('LCTCacheKeys yüklenmemiş');
    return M;
  }

  async function get(videoId) {
    const CacheKeys = getCacheKeys();
    const key = CacheKeys.translation(videoId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  async function set(videoId, cues, fingerprint) {
    if (typeof fingerprint !== 'string' || fingerprint.length === 0) {
      throw new TypeError('fingerprint gerekli (cache invalidation için)');
    }
    const CacheKeys = getCacheKeys();
    const C = getLib('LCTConstants', {});
    const QUOTA_TOKEN = C.CACHE_QUOTA_MESSAGE_TOKEN || 'QUOTA_BYTES';
    const key = CacheKeys.translation(videoId);
    const entry = { cues, fingerprint, timestamp: Date.now() };
    try {
      await chrome.storage.local.set({ [key]: entry });
    } catch (e) {
      if (e && e.message && e.message.includes(QUOTA_TOKEN)) {
        await evictOldest();
        await chrome.storage.local.set({ [key]: entry });
      } else {
        throw e;
      }
    }
  }

  async function evictOldest() {
    const CacheKeys = getCacheKeys();
    const C = getLib('LCTConstants', {});
    const fraction = (typeof C.CACHE_EVICTION_FRACTION === 'number')
      ? C.CACHE_EVICTION_FRACTION
      : 0.25;
    const all = await chrome.storage.local.get(null);
    const cacheEntries = Object.entries(all)
      .filter(([k]) => CacheKeys.isTranslationKey(k))
      .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
    const toRemoveCount = Math.max(1, Math.floor(cacheEntries.length * fraction));
    const toRemove = cacheEntries.slice(0, toRemoveCount);
    await chrome.storage.local.remove(toRemove.map(([k]) => k));
    return toRemove.length;
  }

  return Object.freeze({ get, set, evictOldest });
})();

if (typeof self !== 'undefined') {
  self.LCTTranslationCacheBg = LCTTranslationCacheBg;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTTranslationCacheBg };
}
