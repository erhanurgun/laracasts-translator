/**
 * OpenAI /v1/models endpoint'inden model listesini çeker, 24 saatlik
 * chrome.storage.local cache ile yeniden çağrı sayısını sınırlar.
 * API erişilemezse veya boş liste gelirse OPENAI_MODELS_FALLBACK döndürür.
 *
 * Sadece chat-completion uyumlu modelleri sunar (gpt-*, o*, chatgpt-*).
 * Embedding/whisper/tts/dall-e/realtime/legacy davinci/babbage/curie/ada
 * elenir.
 *
 * Chrome Extension: global `self.LCTModelFetch`.
 * Node (test): `require('lib/model-fetch.js').LCTModelFetch`.
 */
const LCTModelFetch = (() => {
  function getLib(name, fallback) {
    return (typeof self !== 'undefined' && self[name]) || fallback;
  }

  const KEEP_PREFIXES = Object.freeze(['gpt-', 'o1', 'o3', 'o4', 'o5', 'chatgpt-']);
  const EXCLUDE_PATTERNS = Object.freeze([
    /realtime/,
    /audio/,
    /transcribe/,
    /tts/,
    /embedding/,
    /dall-e/,
    /whisper/,
    /davinci-(00|edit|search)/,
    /babbage/,
    /curie/,
    /^ada/,
    /moderation/,
    /image/,
    /search/
  ]);

  // filterModels: OpenAI /v1/models döndüğü gibi {id, created} objelerini
  // veya string id'leri kabul eder. Sıralama: created DESC (en son çıkan üstte).
  // created bilinmiyorsa (string giriş veya eksik field) 0 alır, alfabetik fallback uygulanır.
  function filterModels(rawList) {
    if (!Array.isArray(rawList)) return [];
    const entries = rawList
      .map(m => {
        if (typeof m === 'string') return { id: m, created: 0 };
        if (m && typeof m.id === 'string') {
          return { id: m.id, created: typeof m.created === 'number' ? m.created : 0 };
        }
        return null;
      })
      .filter(e => e && e.id.length > 0);

    const seen = new Set();
    const unique = [];
    for (const e of entries) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        unique.push(e);
      }
    }

    return unique
      .filter(e => KEEP_PREFIXES.some(p => e.id.startsWith(p)))
      .filter(e => !EXCLUDE_PATTERNS.some(re => re.test(e.id)))
      .sort((a, b) => {
        if (b.created !== a.created) return b.created - a.created;
        return a.id.localeCompare(b.id);
      })
      .map(e => e.id);
  }

  async function fetchFromOpenAI(apiKey, fetchImpl) {
    const C = getLib('LCTConstants', {});
    const endpoint = C.OPENAI_MODELS_ENDPOINT || 'https://api.openai.com/v1/models';
    const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!f) throw new Error('fetch yok');

    const response = await f(endpoint, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const data = await response.json();
    const list = (data && Array.isArray(data.data)) ? data.data : [];
    return filterModels(list);
  }

  async function readCache() {
    const C = getLib('LCTConstants', {});
    const key = C.STORAGE_KEY_MODELS_CACHE || '_lct_models_cache';
    const ttl = C.MODELS_CACHE_TTL_MS || 24 * 60 * 60 * 1000;
    const result = await chrome.storage.local.get(key);
    const entry = result[key];
    if (!entry || typeof entry !== 'object') return null;
    if (typeof entry.timestamp !== 'number' || !Array.isArray(entry.models)) return null;
    const age = Date.now() - entry.timestamp;
    if (age > ttl) return null;
    return entry;
  }

  async function writeCache(models, source) {
    const C = getLib('LCTConstants', {});
    const key = C.STORAGE_KEY_MODELS_CACHE || '_lct_models_cache';
    const entry = { models, source, timestamp: Date.now() };
    await chrome.storage.local.set({ [key]: entry });
  }

  async function clearCache() {
    const C = getLib('LCTConstants', {});
    const key = C.STORAGE_KEY_MODELS_CACHE || '_lct_models_cache';
    await chrome.storage.local.remove(key);
  }

  async function getCachedOrFetch(apiKey, forceRefresh, fetchImpl) {
    if (!forceRefresh) {
      const cached = await readCache();
      if (cached && cached.models && cached.models.length > 0) {
        return {
          models: cached.models,
          source: cached.source || 'cache',
          fromCache: true,
          fromFallback: cached.source === 'fallback'
        };
      }
    }

    try {
      const models = await fetchFromOpenAI(apiKey, fetchImpl);
      if (models.length === 0) throw new Error('Boş model listesi');
      await writeCache(models, 'api');
      return { models, source: 'api', fromCache: false, fromFallback: false };
    } catch (err) {
      const C = getLib('LCTConstants', {});
      const fallback = Array.from(C.OPENAI_MODELS_FALLBACK || ['gpt-4o', 'gpt-4o-mini']);
      await writeCache(fallback, 'fallback');
      return {
        models: fallback,
        source: 'fallback',
        fromCache: false,
        fromFallback: true,
        error: err && err.message ? err.message : String(err)
      };
    }
  }

  return Object.freeze({
    KEEP_PREFIXES,
    EXCLUDE_PATTERNS,
    filterModels,
    fetchFromOpenAI,
    readCache,
    writeCache,
    clearCache,
    getCachedOrFetch
  });
})();

if (typeof self !== 'undefined') {
  self.LCTModelFetch = LCTModelFetch;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTModelFetch };
}
