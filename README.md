<p align="center">
  <img src="icons/icon128.png" alt="Laracasts Translator" width="128" height="128">
</p>

<h1 align="center">Laracasts Translator</h1>

<p align="center">
  Laracasts video derslerindeki İngilizce altyazıları gerçek zamanlı olarak Türkçeye çeviren Chrome eklentisi.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/sürüm-0.1.0-blue" alt="Sürüm">
  <img src="https://img.shields.io/badge/lisans-MIT-green" alt="Lisans">
  <img src="https://img.shields.io/badge/chrome-v116%2B-yellow" alt="Chrome">
  <img src="https://img.shields.io/badge/manifest-v3-orange" alt="Manifest V3">
</p>

---

## Ekran Görüntüleri

> Ekran görüntüleri yakında eklenecektir. Detaylar için [`screenshots/README.md`](screenshots/README.md) dosyasına bakın.

---

## Özellikler

- **Gerçek zamanlı çeviri** — Video oynatılırken altyazılar anında Türkçeye çevrilir
- **Çift altyazı gösterimi** — Orijinal (İngilizce) ve çeviri (Türkçe) aynı anda ekranda
- **Batch çeviri** — Altyazılar 50'lik gruplar halinde verimli şekilde çevrilir
- **Progressive güncelleme** — Her batch tamamlandığında çeviriler hemen gösterilir, tamamının bitmesi beklenmez
- **Akıllı önbellek** — Çevrilen altyazılar local storage'da saklanır, aynı video tekrar açıldığında API çağrısı yapılmaz
- **VTT fingerprint doğrulama** — Altyazı içeriği değiştiyse eski önbellek otomatik geçersiz sayılır
- **LRU kota yönetimi** — Depolama kotası aşıldığında en eski önbellek kayıtları otomatik temizlenir
- **Özelleştirilebilir görünüm** — Yazı boyutu, renkler ve arka plan opaklığı popup'tan ayarlanabilir
- **SPA navigasyon takibi** — Laracasts'in tek sayfa uygulama yapısı desteklenir, sayfa yenilemeden video değişimlerinde çeviri devam eder
- **Otomatik yeniden deneme** — Başarısız API çağrıları 3 denemeye kadar tekrarlanır; sayı uyuşmazlığında batch ikiye bölünür

---

## Gereksinimler

| Gereksinim | Detay |
|-----------|-------|
| **Google Chrome** | v116 veya üzeri |
| **OpenAI API key** | [platform.openai.com](https://platform.openai.com) üzerinden alınır |
| **Laracasts hesabı** | Video içeriklerine erişim için aktif üyelik |

---

## Kurulum

### Yöntem 1: Geliştirici Modu (Önerilen)

1. Bu repoyu klonlayın:
   ```bash
   git clone https://github.com/erhanurgun/laracasts-translator.git
   ```
2. Chrome'da `chrome://extensions` adresine gidin
3. Sağ üstten **Geliştirici modu**'nu açın
4. **Paketlenmemiş yükle** butonuna tıklayın ve klonlanan klasörü seçin

### Yöntem 2: Release Paketi

1. [Releases](https://github.com/erhanurgun/laracasts-translator/releases) sayfasından son sürümün `.zip` dosyasını indirin
2. ZIP dosyasını bir klasöre çıkarın
3. Chrome'da `chrome://extensions` → **Paketlenmemiş yükle** ile çıkarılan klasörü seçin

### Yöntem 3: Chrome Web Store

> Chrome Web Store yayını yakında planlanmaktadır.

---

## API Key Kurulumu

1. [platform.openai.com](https://platform.openai.com) adresine gidin ve hesabınıza giriş yapın
2. Sol menüden **API keys** bölümüne gidin
3. **Create new secret key** butonuna tıklayın
4. Oluşturulan anahtarı kopyalayın (`sk-` ile başlar)
5. Chrome araç çubuğundaki Laracasts Translator simgesine tıklayın
6. **OpenAI API Key** alanına anahtarı yapıştırın — otomatik kaydedilir

> **Ücret uyarısı:** OpenAI API kullanımı ücretlidir. Çeviri başına maliyet gpt-4o modeline ve altyazı uzunluğuna bağlıdır. Kullanımınızı [platform.openai.com/usage](https://platform.openai.com/usage) adresinden takip edebilirsiniz.

---

## Kullanım

1. Eklentiyi kurun ve API key'inizi girin
2. [laracasts.com](https://laracasts.com) üzerinde herhangi bir video dersini açın
3. Video oynatıldığında altyazılar otomatik olarak çevrilmeye başlar
4. Çeviri ilerlemesi durum göstergesiyle takip edilir
5. Tamamlanan çeviriler önbelleğe alınır — aynı videoyu tekrar açtığınızda anında gösterilir

> Popup'taki aç/kapat düğmesi ile çeviriyi istediğiniz zaman devre dışı bırakabilirsiniz.

---

## Yapılandırma

Popup menüsünden aşağıdaki ayarlar değiştirilebilir:

| Ayar | Varsayılan | Açıklama |
|------|-----------|----------|
| **Eklenti durumu** | Açık | Çeviriyi etkinleştir/devre dışı bırak |
| **Orijinal altyazı** | Açık | İngilizce altyazıyı göster/gizle |
| **Çeviri altyazısı** | Açık | Türkçe altyazıyı göster/gizle |
| **Yazı boyutu** | 25px | 18px – 45px arası ayarlanabilir |
| **Orijinal renk** | `#ffffff` (beyaz) | Orijinal altyazı metin rengi |
| **Çeviri renk** | `#ffd700` (altın) | Çeviri altyazı metin rengi |
| **Arka plan opaklığı** | %75 | Altyazı arka planının saydamlığı |

---

## Mimari

### Dosya Yapısı

```
laracasts-translator/
├── manifest.json            # Chrome Extension manifest (V3)
├── background.js            # Service Worker — çeviri motoru, OpenAI API, cache
├── content-vimeo.js         # Vimeo iframe — video algılama, VTT, senkronizasyon
├── content-laracasts.js     # Laracasts sayfası — durum göstergesi, SPA takibi
├── popup.html / js / css    # Popup ayarlar arayüzü
├── lib/
│   ├── storage.js           # Chrome Storage API soyutlaması
│   ├── vtt-parser.js        # WebVTT parser
│   └── subtitle-renderer.js # Çift altyazı overlay factory
├── styles/
│   └── subtitle-overlay.css # Altyazı stilleri
└── icons/                   # Eklenti simgeleri (16, 32, 48, 128)
```

### Çeviri Pipeline'ı

```
VTT URL (track element)
  → fetch & parse → cue dizisi
  → 50'lik batch'lere böl
  → her batch için OpenAI API çağrısı (gpt-4o, temperature: 0)
  → numaralı satır eşleştirmesiyle map'le
  → cache'e fingerprint ile kaydet
  → port üzerinden batch sonuçlarını anında gönder
```

### Mesajlaşma

- **Port-based (long-lived):** `content-vimeo.js` ↔ `background.js` — Çeviri progress güncellemeleri
- **Message passing (one-shot):** Ayar değişiklikleri ve durum sorguları

---

## Katkı

Katkıda bulunmak istiyorsanız [CONTRIBUTING.md](CONTRIBUTING.md) dosyasını inceleyin.

---

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

## Teşekkürler

- [Laracasts](https://laracasts.com) — Kaliteli PHP/Laravel eğitim içerikleri
- [OpenAI](https://openai.com) — GPT-4o çeviri motoru
- [Vimeo](https://vimeo.com) — Video altyapısı ve VTT desteği
