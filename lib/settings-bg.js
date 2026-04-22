/**
 * Background service worker için Settings + API key yönetimi (Laracasts).
 * Triple migration: _lct_apiKey_enc -> _lct_apiKey -> sync.apiKey (pre-v0.2.1)
 */
const LCTSettingsBg = (() => {
  function getLib(name, fallback = null) {
    return (typeof self !== 'undefined' && self[name]) || fallback;
  }

  const STORAGE_KEY_LEGACY_LOCAL = '_lct_apiKey';
  const STORAGE_KEY_ENC = '_lct_apiKey_enc';
  const STORAGE_KEY_LEGACY_SYNC = 'apiKey';

  async function getApiKey() {
    const Vault = getLib('LCTCryptoVault');

    // 1. Şifreli key
    const encStored = await chrome.storage.local.get(STORAGE_KEY_ENC);
    const enc = encStored[STORAGE_KEY_ENC];
    if (typeof enc === 'string' && enc.length > 0 && Vault) {
      try {
        return await Vault.decrypt(enc);
      } catch (_) {}
    }

    // 2. Legacy local plaintext
    const legacyLocal = await chrome.storage.local.get(STORAGE_KEY_LEGACY_LOCAL);
    let legacy = legacyLocal[STORAGE_KEY_LEGACY_LOCAL];

    // 3. Pre-v0.2.1 sync storage
    if (!legacy) {
      const legacySync = await chrome.storage.sync.get(STORAGE_KEY_LEGACY_SYNC);
      if (legacySync[STORAGE_KEY_LEGACY_SYNC]) {
        legacy = legacySync[STORAGE_KEY_LEGACY_SYNC];
        try {
          await chrome.storage.sync.remove(STORAGE_KEY_LEGACY_SYNC);
        } catch (_) {}
      }
    }

    if (typeof legacy === 'string' && legacy.length > 0) {
      if (Vault) {
        try {
          const encBlob = await Vault.encrypt(legacy);
          await chrome.storage.local.set({ [STORAGE_KEY_ENC]: encBlob });
          await chrome.storage.local.remove(STORAGE_KEY_LEGACY_LOCAL);
        } catch (_) {}
      }
      return legacy;
    }
    return '';
  }

  async function getSettings() {
    const C = getLib('LCTConstants', {});
    const defaults = C.DEFAULT_SETTINGS || {
      enabled: true,
      showOriginal: true,
      showTranslation: true,
      fontSize: 25,
      originalColor: '#ffffff',
      translationColor: '#ffd700',
      bgOpacity: 0.75,
      blurOriginal: false
    };
    const settings = await chrome.storage.sync.get(defaults);
    settings.apiKey = await getApiKey();
    return settings;
  }

  return Object.freeze({
    STORAGE_KEY_LEGACY_LOCAL,
    STORAGE_KEY_ENC,
    STORAGE_KEY_LEGACY_SYNC,
    getApiKey,
    getSettings
  });
})();

if (typeof self !== 'undefined') {
  self.LCTSettingsBg = LCTSettingsBg;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTSettingsBg };
}
