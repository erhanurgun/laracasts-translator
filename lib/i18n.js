/**
 * Popup için iki dilli mesaj bundle'ı (TR varsayılan, EN seçenek).
 * Anahtarlar `area.context.id` deseninde organize edilir.
 *
 * Kullanım:
 *   const text = LCT_I18N.t('popup.apiKey.label', 'tr');
 *   LCT_I18N.applyTo(document.body, settings.uiLanguage);
 *
 * Şablon değişkenleri: `{name}` placeholder, vars objesinden değiştirilir.
 *   LCT_I18N.t('popup.cache.stats', 'tr', { count: 3, sizeKB: 42 });
 *
 * Chrome Extension: global `self.LCT_I18N`.
 * Node (test): `require('lib/i18n.js').LCT_I18N`.
 */
const LCT_I18N_BUNDLES = Object.freeze({
  tr: Object.freeze({
    'popup.title': 'Laracasts Translator',

    'popup.apiKey.label': 'OpenAI API Key',
    'popup.apiKey.link': '(API key almak için tıklayın)',
    'popup.apiKey.placeholder': 'sk-...',
    'popup.apiKey.toggleTitle': 'Göster/Gizle',
    'popup.apiKey.saved': 'API key kayıtlı',
    'popup.apiKey.savedActive': 'API key kaydedildi. Aktif videolar için çeviri başlatılıyor...',
    'popup.apiKey.missing': 'API key gerekli',
    'popup.apiKey.invalidFormat': 'Geçersiz format - OpenAI key "sk-" ile başlamalı',

    'popup.subtitle.title': 'Altyazı Ayarları',
    'popup.subtitle.showOriginal': 'Orijinal altyazıyı göster',
    'popup.subtitle.showTranslation': 'Çeviriyi göster',
    'popup.subtitle.blurOriginal': 'Orijinali bulanıklaştır',
    'popup.subtitle.blurOriginalTooltip': 'Öğrenme modu: orijinal metin bulanık görünür, fare üzerine gelince netleşir.',
    'popup.subtitle.fontSize': 'Yazı boyutu',
    'popup.subtitle.originalColor': 'Orijinal renk',
    'popup.subtitle.translationColor': 'Çeviri renk',
    'popup.subtitle.bgOpacity': 'Arka plan opaklığı',

    'popup.language.section': 'Dil ve Model',
    'popup.language.ui': 'Arayüz dili',
    'popup.language.target': 'Çeviri hedef dili',

    'popup.model.label': 'OpenAI modeli',
    'popup.model.refresh': 'Modelleri yenile',
    'popup.model.loading': 'Modeller yükleniyor...',
    'popup.model.error': 'Modeller alınamadı, fallback liste kullanılıyor',
    'popup.model.needsKey': 'Modelleri listelemek için API key gerekli',
    'popup.model.cachedFallback': 'Aktif model listede yoksa varsayılan model kullanılır',

    'popup.reset': 'Varsayılana Sıfırla',

    'popup.cache.title': 'Önbellek',
    'popup.cache.clear': 'Önbelleği Temizle',
    'popup.cache.stats': '{count} video önbellekte ({sizeKB} KB)',
    'popup.cache.loading': 'Yükleniyor...'
  }),
  en: Object.freeze({
    'popup.title': 'Laracasts Translator',

    'popup.apiKey.label': 'OpenAI API Key',
    'popup.apiKey.link': '(Click to obtain an API key)',
    'popup.apiKey.placeholder': 'sk-...',
    'popup.apiKey.toggleTitle': 'Show/Hide',
    'popup.apiKey.saved': 'API key saved',
    'popup.apiKey.savedActive': 'API key saved. Starting translation for active videos...',
    'popup.apiKey.missing': 'API key required',
    'popup.apiKey.invalidFormat': 'Invalid format - OpenAI key must start with "sk-"',

    'popup.subtitle.title': 'Subtitle Settings',
    'popup.subtitle.showOriginal': 'Show original subtitle',
    'popup.subtitle.showTranslation': 'Show translation',
    'popup.subtitle.blurOriginal': 'Blur original',
    'popup.subtitle.blurOriginalTooltip': 'Learning mode: the original text appears blurred and clears on hover.',
    'popup.subtitle.fontSize': 'Font size',
    'popup.subtitle.originalColor': 'Original color',
    'popup.subtitle.translationColor': 'Translation color',
    'popup.subtitle.bgOpacity': 'Background opacity',

    'popup.language.section': 'Language & Model',
    'popup.language.ui': 'Interface language',
    'popup.language.target': 'Translation target language',

    'popup.model.label': 'OpenAI model',
    'popup.model.refresh': 'Refresh models',
    'popup.model.loading': 'Loading models...',
    'popup.model.error': 'Failed to fetch models, using fallback list',
    'popup.model.needsKey': 'API key required to list models',
    'popup.model.cachedFallback': 'If the active model is not listed, the default model will be used',

    'popup.reset': 'Reset to defaults',

    'popup.cache.title': 'Cache',
    'popup.cache.clear': 'Clear cache',
    'popup.cache.stats': '{count} videos cached ({sizeKB} KB)',
    'popup.cache.loading': 'Loading...'
  })
});

const LCT_I18N = Object.freeze({
  BUNDLES: LCT_I18N_BUNDLES,
  DEFAULT_LANG: 'tr',

  t(key, lang, vars) {
    const useLang = (typeof lang === 'string' && LCT_I18N_BUNDLES[lang]) ? lang : this.DEFAULT_LANG;
    const bundle = LCT_I18N_BUNDLES[useLang];
    const fallbackBundle = LCT_I18N_BUNDLES[this.DEFAULT_LANG];
    let str = bundle[key];
    if (typeof str !== 'string') str = fallbackBundle[key];
    if (typeof str !== 'string') return key;
    if (vars && typeof vars === 'object') {
      for (const [k, v] of Object.entries(vars)) {
        str = str.split(`{${k}}`).join(String(v));
      }
    }
    return str;
  },

  applyTo(root, lang) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const useLang = (typeof lang === 'string' && LCT_I18N_BUNDLES[lang]) ? lang : this.DEFAULT_LANG;
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n, useLang);
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = this.t(el.dataset.i18nTitle, useLang);
    });
    root.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
      el.dataset.tooltip = this.t(el.dataset.i18nTooltip, useLang);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder, useLang);
    });
  },

  // Test ve runtime sanity: her iki bundle aynı anahtar setini sunmalı.
  // Eksik anahtar listesini döndürür (boş array sağlıklı durum).
  findMissingKeys() {
    const trKeys = Object.keys(LCT_I18N_BUNDLES.tr);
    const enKeys = Object.keys(LCT_I18N_BUNDLES.en);
    const inTrNotEn = trKeys.filter(k => !(k in LCT_I18N_BUNDLES.en));
    const inEnNotTr = enKeys.filter(k => !(k in LCT_I18N_BUNDLES.tr));
    return { missingInEn: inTrNotEn, missingInTr: inEnNotTr };
  }
});

if (typeof self !== 'undefined') {
  self.LCT_I18N = LCT_I18N;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCT_I18N, LCT_I18N_BUNDLES };
}
