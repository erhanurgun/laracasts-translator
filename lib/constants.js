/**
 * LCT merkezi sabitleri. Tüm modüller buradan tek kaynak okur.
 * Chrome Extension: global `self.LCTConstants`.
 * Node (test): `require('lib/constants.js').LCTConstants`.
 */
const LCTConstants = Object.freeze({
  // Çeviri akışı
  BATCH_SIZE: 50,
  MAX_TRANSLATION_RETRIES: 3,
  TRANSLATION_TIMEOUT_MS: 60000,
  LONG_CUE_THRESHOLD: 70,

  // OpenAI
  OPENAI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
  OPENAI_MODEL: 'gpt-4o',
  OPENAI_TEMPERATURE: 0,

  // Güvenilir Laracasts origin allowlist'i
  TRUSTED_ORIGINS: Object.freeze([
    'https://laracasts.com',
    'https://www.laracasts.com'
  ]),
  LARACASTS_ORIGIN_REGEX: /^https:\/\/(www\.)?laracasts\.com$/,
  LARACASTS_URL_REGEX: /^https:\/\/(www\.)?laracasts\.com\//,

  // Keep-alive alarmı
  KEEPALIVE_ALARM: 'lct-keepalive',
  KEEPALIVE_INTERVAL_MINUTES: 0.4,

  // Çeviri cache şeması
  CACHE_KEY_PREFIX: 'translation_',
  CACHE_KEY_SUFFIX: '_tr',
  CACHE_QUOTA_MESSAGE_TOKEN: 'QUOTA_BYTES',
  CACHE_EVICTION_FRACTION: 0.25,

  // Fingerprint (v2: Laracasts mevcut sürümüyle uyumlu)
  FINGERPRINT_VERSION: 'v2',

  // Storage anahtarları
  STORAGE_KEY_LEGACY_API: '_lct_apiKey',
  STORAGE_KEY_ENC_API: '_lct_apiKey_enc',
  STORAGE_KEY_VAULT: '_lct_vault_key',
  STORAGE_KEY_KEEPALIVE: '_lct_keepalive',

  // Legacy sync storage key (Laracasts pre-v0.2.1'de apiKey sync'teydi)
  STORAGE_KEY_SYNC_API_LEGACY: 'apiKey',

  // Sync storage için varsayılan ayarlar
  DEFAULT_SETTINGS: Object.freeze({
    enabled: true,
    showOriginal: true,
    showTranslation: true,
    fontSize: 25,
    originalColor: '#ffffff',
    translationColor: '#ffd700',
    bgOpacity: 0.75,
    blurOriginal: false
  }),

  // Prompt sanitizer için üst sınır
  MAX_CAPTION_LENGTH_FOR_PROMPT: 500,

  // Log sanitizer
  VIDEO_ID_LOG_PREFIX_LEN: 4
});

if (typeof self !== 'undefined') {
  self.LCTConstants = LCTConstants;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTConstants };
}
