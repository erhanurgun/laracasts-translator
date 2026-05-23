# Changelog

Tüm önemli değişiklikler bu dosyada belgelenir.
Format [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) standardını takip eder ve proje [Semantic Versioning](https://semver.org/spec/v2.0.0.html) kullanır.

## [0.5.0] - 2026-05-23

Çoklu dil ve dinamik model desteğine geçiş. v0.4.x kullanıcıları için backward-compatible.

### Eklendi

- Arayüz dili seçimi: Türkçe (varsayılan) ve İngilizce. Popup'tan değiştirilir, tüm metinler anlık güncellenir
- Çeviri hedef dili seçimi: 25 BCP-47 dil (tr, en, de, es, fr, it, pt-BR, pt-PT, ja, ko, zh-CN, zh-TW, ar, ru, nl, pl, sv, da, no, fi, cs, uk, hi, id, vi). Varsayılan: tr
- Dinamik OpenAI model seçimi: `/v1/models` endpoint'inden çekilir, 24 saatlik `chrome.storage.local` cache, yenile butonuyla cache atlatılır
- Fallback model listesi (`gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`): API erişilemediğinde sunulur
- Dil veya model değişiminde aktif çeviri otomatik yenilenir (sayfa yenileme gerekmez)
- `lib/languages.js`: BCP-47 dil registry'si + `getTargetName`, `getTargetNative`, `isSupportedTarget`, `isSupportedUi` helper'ları
- `lib/i18n.js`: popup için iki dilli mesaj bundle (TR/EN) + `t(key, lang, vars)` çözücü + `applyTo(root, lang)` DOM gezgini
- `lib/model-fetch.js`: `getCachedOrFetch(apiKey, forceRefresh)` ile API+cache orkestrasyonu, modelleri filtreleme (gpt-/o*/chatgpt- tutulur, embedding/whisper/tts/dall-e/realtime/audio/legacy elenir)
- 48 yeni birim test (toplam 259 geçen test, %95+ coverage hedefi korunur)

### Değişti

- Cache key şeması: `translation_<videoId>_tr` -> `translation_<videoId>_<langCode>`. Eski `_tr` suffix'i yeni regex'e uyduğu için migration gerekmez
- `translateBatch(texts, apiKey, settings, retryCount)` artık settings parametresi alır. `body.model` settings.openaiModel'den, system prompt LCTLanguages.getTargetName(settings.targetLanguage)'dan çözülür
- `SYSTEM_PROMPT` sabiti `buildSystemPrompt(targetLanguageName)` fonksiyonuna dönüştürüldü
- `LCTCacheKeys.translation(videoId, langCode)`: ikinci parametre BCP-47 kod, geçersizse `tr` fallback
- `LCTTranslationCacheBg.get/set` langCode parametresi alır, entry'ye `langCode` alanı eklenir
- `LCTCacheKeys.isTranslationKey` regex'i `/^translation_(.+)_([a-z]{2}(?:-[A-Z]{2})?)$/` (BCP-47 uyumlu)
- Popup tüm hardcoded string'ler `data-i18n` öznitelikleriyle işaretlendi, dil değişiminde anlık uygulanır
- Popup'a "Dil ve Model" bölümü eklendi: arayüz dili, çeviri hedef dili, OpenAI modeli + yenile butonu, model status alanı
- `DEFAULT_SETTINGS`: `uiLanguage: 'tr'`, `targetLanguage: 'tr'`, `openaiModel: 'gpt-4o'` alanları eklendi
- background importScripts: `lib/languages.js` ve `lib/model-fetch.js` eklendi

### Migration

- v0.4.x kullanıcıları için otomatik. `chrome.storage.sync.get(defaults)` zaten eksik alanları defaults ile doldurur, mevcut ayarlar korunur
- Eski `translation_<id>_tr` cache anahtarları yeni regex'e uyumlu, kullanıcı `tr` seçimine devam ederse hit verir
- `host_permissions` değişmedi (`https://api.openai.com/v1/*` `/v1/models` endpoint'ini kapsıyor), ek izin onayı gerektirmez

## [0.4.2] - 2026-05-22

### Düzeltildi
- Mux streaming sırasında listener temizliği ve memory leak düzeltmeleri (PR #35)
- Cleanup timer, anonim listener, orchestrator leak, polling duplikasyon

## [0.4.1] - 2026-05-22

### Düzeltildi
- Mux storyboard.vtt altyazı sanılma hatası (PR #34)

## [0.4.0] - 2026-04-21

### Eklendi
- Ekran görüntüleri README'ye eklendi
- 20 lib modülünden oluşan mimari belgelendi
- Mux Player desteği (v0.2.0+ adopsiyonu)

## Sürüm Geçmişi

Daha eski sürümler için `git log` ve [Releases](https://github.com/erhanurgun/laracasts-translator/releases) sayfasına bakınız.
