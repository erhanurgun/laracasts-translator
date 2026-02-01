/**
 * Chrome Storage wrapper - ayarlar sync, cache local storage'da tutulur.
 */
const Storage = {
  defaults: {
    apiKey: '',
    enabled: true,
    showOriginal: true,
    showTranslation: true,
    fontSize: 16,
    originalColor: '#ffffff',
    translationColor: '#ffd700',
    bgOpacity: 0.75
  },

  async getSettings() {
    const result = await chrome.storage.sync.get(this.defaults);
    return result;
  },

  async saveSetting(key, value) {
    await chrome.storage.sync.set({ [key]: value });
  },

  async saveSettings(settings) {
    await chrome.storage.sync.set(settings);
  },

  async getApiKey() {
    const { apiKey } = await chrome.storage.sync.get({ apiKey: '' });
    return apiKey;
  },

  async setApiKey(key) {
    await chrome.storage.sync.set({ apiKey: key });
  },

  // --- Çeviri cache ---

  _cacheKey(videoId) {
    return `translation_${videoId}_tr`;
  },

  async getCachedTranslation(videoId) {
    const key = this._cacheKey(videoId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  },

  async setCachedTranslation(videoId, cues) {
    const key = this._cacheKey(videoId);
    const entry = { cues, timestamp: Date.now() };

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
    const cacheEntries = Object.entries(all)
      .filter(([k]) => k.startsWith('translation_'))
      .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

    // En eski %25'i sil
    const toRemove = cacheEntries.slice(0, Math.max(1, Math.floor(cacheEntries.length / 4)));
    await chrome.storage.local.remove(toRemove.map(([k]) => k));
  },

  async getCacheStats() {
    const all = await chrome.storage.local.get(null);
    const entries = Object.entries(all).filter(([k]) => k.startsWith('translation_'));
    const totalSize = JSON.stringify(entries).length;
    return {
      count: entries.length,
      sizeKB: Math.round(totalSize / 1024)
    };
  },

  async clearCache() {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(k => k.startsWith('translation_'));
    await chrome.storage.local.remove(keys);
  }
};
