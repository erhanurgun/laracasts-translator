/**
 * Çeviri cache anahtarlarını tek yerde yönetir.
 *
 * Şema: translation_<videoId>_<langCode>
 *   - langCode BCP-47 (xx veya xx-XX). Varsayılan 'tr'.
 *   - Eski tek-dilli şema (translation_<videoId>_tr) yeni regex'e uyduğu için
 *     migration gerekmez; aynı kullanıcı tr seçimini sürdürürse hit verir.
 */
const LCTCacheKeys = Object.freeze({
  PREFIX: 'translation_',
  DEFAULT_LANG: 'tr',
  LANG_REGEX: /^[a-z]{2}(-[A-Z]{2})?$/,
  KEY_REGEX: /^translation_(.+)_([a-z]{2}(?:-[A-Z]{2})?)$/,

  translation(videoId, langCode) {
    if (typeof videoId !== 'string' || videoId.length === 0) {
      throw new TypeError('videoId boş olmayan string olmalı');
    }
    const lang = (typeof langCode === 'string' && this.LANG_REGEX.test(langCode))
      ? langCode
      : this.DEFAULT_LANG;
    return `${this.PREFIX}${videoId}_${lang}`;
  },

  isTranslationKey(key) {
    return typeof key === 'string' && this.KEY_REGEX.test(key);
  },

  extractVideoId(key) {
    if (!this.isTranslationKey(key)) return null;
    const m = key.match(this.KEY_REGEX);
    return m ? m[1] : null;
  },

  extractLangCode(key) {
    if (!this.isTranslationKey(key)) return null;
    const m = key.match(this.KEY_REGEX);
    return m ? m[2] : null;
  }
});

if (typeof self !== 'undefined') {
  self.LCTCacheKeys = LCTCacheKeys;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTCacheKeys };
}
