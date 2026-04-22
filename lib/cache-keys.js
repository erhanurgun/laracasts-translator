/**
 * Çeviri cache anahtarlarını tek yerde yönetir.
 * Laracasts şeması: translation_<videoId>_tr
 * (yt-translator'dan farklı: "translation_yt_" yerine "translation_" prefix)
 */
const LCTCacheKeys = Object.freeze({
  PREFIX: 'translation_',
  SUFFIX: '_tr',

  translation(videoId) {
    if (typeof videoId !== 'string' || videoId.length === 0) {
      throw new TypeError('videoId boş olmayan string olmalı');
    }
    return `${this.PREFIX}${videoId}${this.SUFFIX}`;
  },

  isTranslationKey(key) {
    return typeof key === 'string'
      && key.length > this.PREFIX.length + this.SUFFIX.length
      && key.startsWith(this.PREFIX)
      && key.endsWith(this.SUFFIX);
  },

  extractVideoId(key) {
    if (!this.isTranslationKey(key)) return null;
    return key.slice(this.PREFIX.length, key.length - this.SUFFIX.length);
  }
});

if (typeof self !== 'undefined') {
  self.LCTCacheKeys = LCTCacheKeys;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTCacheKeys };
}
