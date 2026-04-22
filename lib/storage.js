/**
 * Chrome Storage wrapper - popup tarafında kullanılır.
 * API key AES-GCM ile şifrelenip chrome.storage.local._lct_apiKey_enc altında
 * saklanır. Eski plaintext (_lct_apiKey) ve pre-v0.2.1 sync (apiKey) ilk
 * okumada migrate edilir.
 */
const Storage = {
  defaults: {
    apiKey: '',
    enabled: true,
    showOriginal: true,
    showTranslation: true,
    fontSize: 25,
    originalColor: '#ffffff',
    translationColor: '#ffd700',
    bgOpacity: 0.75,
    blurOriginal: false
  },

  async getSettings() {
    const { apiKey: _ignored, ...syncDefaults } = this.defaults;
    const result = await chrome.storage.sync.get(syncDefaults);
    result.apiKey = await this.getApiKey();
    return result;
  },

  async saveSetting(key, value) {
    await chrome.storage.sync.set({ [key]: value });
  },

  async saveSettings(settings) {
    await chrome.storage.sync.set(settings);
  },

  async getApiKey() {
    const encStored = await chrome.storage.local.get('_lct_apiKey_enc');
    const enc = encStored._lct_apiKey_enc;
    if (typeof enc === 'string' && enc.length > 0) {
      try { return await self.LCTCryptoVault.decrypt(enc); } catch (_) {}
    }

    const legacyLocal = await chrome.storage.local.get('_lct_apiKey');
    let legacy = legacyLocal._lct_apiKey;

    if (!legacy) {
      const legacySync = await chrome.storage.sync.get('apiKey');
      if (legacySync.apiKey) {
        legacy = legacySync.apiKey;
        try { await chrome.storage.sync.remove('apiKey'); } catch (_) {}
      }
    }

    if (typeof legacy === 'string' && legacy.length > 0) {
      try {
        const encBlob = await self.LCTCryptoVault.encrypt(legacy);
        await chrome.storage.local.set({ _lct_apiKey_enc: encBlob });
        await chrome.storage.local.remove('_lct_apiKey');
      } catch (_) {}
      return legacy;
    }
    return '';
  },

  async setApiKey(key) {
    if (!key) {
      await chrome.storage.local.remove(['_lct_apiKey', '_lct_apiKey_enc']);
      return;
    }
    const encBlob = await self.LCTCryptoVault.encrypt(key);
    await chrome.storage.local.set({ _lct_apiKey_enc: encBlob });
    await chrome.storage.local.remove('_lct_apiKey');
  },

  _cacheKey(videoId) {
    return self.LCTCacheKeys
      ? self.LCTCacheKeys.translation(videoId)
      : `translation_${videoId}_tr`;
  },

  async getCachedTranslation(videoId) {
    const key = this._cacheKey(videoId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  },

  async setCachedTranslation(videoId, cues, fingerprint) {
    const key = this._cacheKey(videoId);
    const entry = { cues, fingerprint, timestamp: Date.now() };
    try {
      await chrome.storage.local.set({ [key]: entry });
    } catch (e) {
      if (e.message && e.message.includes('QUOTA_BYTES')) {
        await this._evictOldest();
        await chrome.storage.local.set({ [key]: entry });
      }
    }
  },

  async _evictOldest() {
    const all = await chrome.storage.local.get(null);
    const isCacheKey = (k) => (self.LCTCacheKeys
      ? self.LCTCacheKeys.isTranslationKey(k)
      : (k.startsWith('translation_') && k.endsWith('_tr')));
    const cacheEntries = Object.entries(all)
      .filter(([k]) => isCacheKey(k))
      .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
    const toRemove = cacheEntries.slice(0, Math.max(1, Math.floor(cacheEntries.length / 4)));
    await chrome.storage.local.remove(toRemove.map(([k]) => k));
  },

  async getCacheStats() {
    const all = await chrome.storage.local.get(null);
    const isCacheKey = (k) => (self.LCTCacheKeys
      ? self.LCTCacheKeys.isTranslationKey(k)
      : k.startsWith('translation_'));
    const entries = Object.entries(all).filter(([k]) => isCacheKey(k));
    const totalSize = JSON.stringify(entries).length;
    return {
      count: entries.length,
      sizeKB: Math.round(totalSize / 1024)
    };
  },

  async clearCache() {
    const all = await chrome.storage.local.get(null);
    const isCacheKey = (k) => (self.LCTCacheKeys
      ? self.LCTCacheKeys.isTranslationKey(k)
      : k.startsWith('translation_'));
    const keys = Object.keys(all).filter(isCacheKey);
    await chrome.storage.local.remove(keys);
  }
};
