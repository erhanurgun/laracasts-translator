/**
 * LCT desteklenen diller. Tek kaynak.
 * UI: popup arayüzü için kullanılacak diller (TR/EN sabit).
 * TARGET: çeviri hedef dili olarak sunulan diller (BCP-47).
 * Kaynak dil her zaman İngilizce (Laracasts İngilizce yayın yapıyor).
 *
 * Chrome Extension: global `self.LCTLanguages`.
 * Node (test): `require('lib/languages.js').LCTLanguages`.
 */
const LCTLanguages = Object.freeze({
  UI: Object.freeze([
    Object.freeze({ code: 'tr', native: 'Türkçe', english: 'Turkish' }),
    Object.freeze({ code: 'en', native: 'English', english: 'English' })
  ]),

  // OpenAI çeviri için sunulan hedef diller.
  // `name` system prompt'a İngilizce isim olarak gider; `native` UI dropdown'da
  // ana dilde gösterilir. `tr` listeyi açan varsayılan seçenek.
  TARGET: Object.freeze([
    Object.freeze({ code: 'tr', name: 'Turkish', native: 'Türkçe' }),
    Object.freeze({ code: 'en', name: 'English', native: 'English' }),
    Object.freeze({ code: 'de', name: 'German', native: 'Deutsch' }),
    Object.freeze({ code: 'es', name: 'Spanish', native: 'Español' }),
    Object.freeze({ code: 'fr', name: 'French', native: 'Français' }),
    Object.freeze({ code: 'it', name: 'Italian', native: 'Italiano' }),
    Object.freeze({ code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português (BR)' }),
    Object.freeze({ code: 'pt-PT', name: 'Portuguese (Portugal)', native: 'Português (PT)' }),
    Object.freeze({ code: 'ja', name: 'Japanese', native: '日本語' }),
    Object.freeze({ code: 'ko', name: 'Korean', native: '한국어' }),
    Object.freeze({ code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' }),
    Object.freeze({ code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文' }),
    Object.freeze({ code: 'ar', name: 'Arabic', native: 'العربية' }),
    Object.freeze({ code: 'ru', name: 'Russian', native: 'Русский' }),
    Object.freeze({ code: 'nl', name: 'Dutch', native: 'Nederlands' }),
    Object.freeze({ code: 'pl', name: 'Polish', native: 'Polski' }),
    Object.freeze({ code: 'sv', name: 'Swedish', native: 'Svenska' }),
    Object.freeze({ code: 'da', name: 'Danish', native: 'Dansk' }),
    Object.freeze({ code: 'no', name: 'Norwegian', native: 'Norsk' }),
    Object.freeze({ code: 'fi', name: 'Finnish', native: 'Suomi' }),
    Object.freeze({ code: 'cs', name: 'Czech', native: 'Čeština' }),
    Object.freeze({ code: 'uk', name: 'Ukrainian', native: 'Українська' }),
    Object.freeze({ code: 'hi', name: 'Hindi', native: 'हिन्दी' }),
    Object.freeze({ code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' }),
    Object.freeze({ code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' })
  ]),

  // BCP-47 kodundan system prompt'a girecek İngilizce dil adını döndürür.
  // Bilinmeyen kod için Turkish fallback (varsayılan davranışı korur).
  getTargetName(code) {
    if (typeof code !== 'string') return 'Turkish';
    const entry = this.TARGET.find(l => l.code === code);
    return entry ? entry.name : 'Turkish';
  },

  // BCP-47 kodundan native adı döndürür (UI listeleme için).
  getTargetNative(code) {
    if (typeof code !== 'string') return 'Türkçe';
    const entry = this.TARGET.find(l => l.code === code);
    return entry ? entry.native : 'Türkçe';
  },

  isSupportedTarget(code) {
    return typeof code === 'string' && this.TARGET.some(l => l.code === code);
  },

  isSupportedUi(code) {
    return typeof code === 'string' && this.UI.some(l => l.code === code);
  }
});

if (typeof self !== 'undefined') {
  self.LCTLanguages = LCTLanguages;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTLanguages };
}
