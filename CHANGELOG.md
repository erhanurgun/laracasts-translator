# Değişiklik Günlüğü

Bu dosya [Keep a Changelog](https://keepachangelog.com/tr/1.0.0/) formatını takip eder ve
proje [Semantic Versioning](https://semver.org/lang/tr/) kullanır.

## [0.2.0] - 2026-02-20

### Eklenen

- Laracasts Vimeo → Mux altyapı geçişine uyum: Inertia `transcriptSegments` desteği
- Mux Player shadow DOM içinde video algılama (`deepQuerySelector` ile BFS tarama)
- Transcript segment'lerinin cümle bazlı parçalanması (`splitSegmentToSentences`)
- Paragraf büyüklüğündeki altyazılar artık 1-2 cümle halinde gösteriliyor
- Karakter oranına göre zaman dağıtımı ile doğru altyazı senkronizasyonu
- Kısa parçaların (< 10 karakter) otomatik birleştirilmesi
- Zamanlama bilgisi olmayan segment'ler için güvenli fallback

### Değişen

- Video algılama: Vimeo iframe yerine Mux Player web component desteği eklendi
- `findTranscriptSegments()` artık `flatMap` ile cümle bazlı cue dizisi döndürüyor
- Altyazı kaynağı önceliği: Inertia transcriptSegments > DOM track > TextTrack API
- Inertia transcriptSegments log mesajları daha açıklayıcı hale getirildi

## [0.1.0] - 2026-02-02

### Eklenen

- OpenAI GPT-4o ile gerçek zamanlı İngilizce → Türkçe altyazı çevirisi
- Çift altyazı overlay sistemi (orijinal + çeviri aynı anda)
- 50'lik batch'ler halinde verimli çeviri pipeline'ı
- Progressive güncelleme - her batch tamamlandığında çeviriler anında gösterilir
- Port-based mesajlaşma ile çeviri ilerleme takibi
- Başarısız batch'ler için 3 denemeye kadar otomatik yeniden deneme
- Sayı uyuşmazlığında batch'i ikiye bölerek tekrar deneme mekanizması
- Chrome local storage'da çeviri önbelleği
- VTT fingerprint ile stale cache tespiti
- LRU mantığıyla otomatik kota yönetimi (en eski %25 temizleme)
- WebVTT parser (`lib/vtt-parser.js`)
- Subtitle renderer factory (`lib/subtitle-renderer.js`)
- Chrome Storage API soyutlaması (`lib/storage.js`)
- Popup ayarlar arayüzü:
    - API key yönetimi (göster/gizle, format doğrulama)
    - Eklenti aç/kapat
    - Orijinal altyazı göster/gizle
    - Çeviri altyazısı göster/gizle
    - Yazı boyutu ayarı (18px – 45px)
    - Orijinal ve çeviri metin renk seçimi
    - Arka plan opaklığı ayarı
    - Önbellek istatistikleri ve temizleme
- Laracasts SPA navigasyon takibi
- Vimeo iframe içinde video algılama ve altyazı senkronizasyonu
- Chrome Extension Manifest V3 uyumluluğu
- MIT lisansı
- Kapsamlı Türkçe README
- Katkıda bulunma rehberi (CONTRIBUTING.md)
- GitHub issue ve PR şablonları

[0.2.0]: https://github.com/erhanurgun/laracasts-translator/releases/tag/v0.2.0
[0.1.0]: https://github.com/erhanurgun/laracasts-translator/releases/tag/v0.1.0
