# Performans UAT Senaryoları

Bu doküman performans paketinin (Laracasts video player kasıntı düzeltmeleri) manuel doğrulama adımlarını içerir. Her senaryoda mevcut durum (Before) ve hedeflenen sonuç (After) verilmiştir.

## Ön Hazırlık

1. `chrome://extensions` → Geliştirici modu açık → **Paketlenmemiş yükle** → projeyi seç.
2. Eklenti yüklenmeli.
3. Popup'tan `sk-` ile başlayan geçerli bir OpenAI API key gir.
4. Laracasts'te 1080p bir video aç (ör. `https://laracasts.com/series/everything-new-in-livewire-4/episodes/1`).
5. Çevirinin tamamlanmasını bekle.
6. Chrome DevTools → Performance tab (F12 → Performance).

## Senaryo 1: Seek Smoothness

**Adımlar:**
1. Video oynatılırken DevTools Performance Record başlat.
2. 30 saniye boyunca 5 kere ileri seek (>30sn) ve 5 kere geri seek (<10sn) yap.
3. Record durdur, **Frames** görünümünde dropped frame sayısını oku.

| Before | After hedef |
|---|---|
| 30-50 dropped frame | 0-5 dropped frame |

**Pass kriteri:** Dropped frame sayısı 10'un altında.

## Senaryo 2: Play/Pause Responsiveness

**Adımlar:**
1. Video açık, eklenti aktif.
2. Boşluk tuşu ile ardışık 20 kez play/pause yap.
3. Mux Player kontrol bar UI'nın butona tepkisini gözlemle (görsel feedback gecikme süresi).

| Before | After hedef |
|---|---|
| 100-200ms gecikme | <50ms |

**Pass kriteri:** Butona basıldığında video durumu anlık değişir, takılma hissi yok.

## Senaryo 3: Idle CPU

**Adımlar:**
1. Video paused durumda.
2. Chrome Task Manager (Shift+Esc) aç.
3. Laracasts sekmesinin CPU kullanımını oku (10 saniye ortalama).

| Before | After hedef |
|---|---|
| %3-5 | %0-1 |

**Pass kriteri:** Idle CPU %2 altında.

## Senaryo 4: Memory Stability

**Adımlar:**
1. DevTools → Memory tab → Heap snapshot al (A).
2. 5 dakika boyunca video oynat + her 30 saniyede 1 seek yap.
3. Yeni heap snapshot al (B).
4. Compare: B - A delta. Özellikle:
   - Detached DOM nodes
   - MutationObserver count
   - Promise resolution backlog

| Before | After hedef |
|---|---|
| +5-15MB | +0-2MB |

**Pass kriteri:** Bellek artışı linear değil, plateau yapıyor. Detached DOM nodes < 50.

## Senaryo 5: SPA Navigation Cleanup

**Adımlar:**
1. Ders 1'de çeviri tamamlandı.
2. Console aç (F12 → Console).
3. Sidebar'dan ders 2'ye tıkla.
4. Console'da `LCT: Video bulundu` ve `LCT: Çeviri tamamlandı` mesajlarını gör.
5. Heap snapshot al, eski observer/poll referanslarının disconnect olduğunu doğrula.

**Pass kriteri:**
- Yeni dersin çevirisi 1-2 saniye içinde başlıyor.
- Eski ders'in MutationObserver'ları artık aktif değil.
- DeepQuery cache eski host'tan temizlendi (`LCTDeepQuery.invalidate()` cleanup'ta çağrılır).

## Bonus: Background Tab CPU

**Adımlar:**
1. Video oynatma sırasında sekmeyi arka plana al (başka pencere/sekme).
2. Chrome Task Manager → CPU 30 saniye boyunca izle.

| Before | After hedef |
|---|---|
| %1-3 (polling devam) | %0 (visibility-aware pause) |

**Pass kriteri:** CPU kullanımı %0.5 altında. createPoll'un visibility-aware mekanizması setInterval'leri pause etmiş olmalı.

## Otomatik Test Doğrulaması

```bash
pnpm test
```

Beklenen: 295 test yeşil (24 dosya).

## Rapor Şablonu

UAT sonrası bu şablonu doldur:

```
- Senaryo 1 (Seek): [PASS/FAIL] dropped frames: ___
- Senaryo 2 (Play/Pause): [PASS/FAIL] gecikme: ___ ms
- Senaryo 3 (Idle CPU): [PASS/FAIL] %: ___
- Senaryo 4 (Memory): [PASS/FAIL] delta MB: ___, detached nodes: ___
- Senaryo 5 (SPA): [PASS/FAIL] geçiş süresi: ___ ms
- Bonus (Background): [PASS/FAIL] %: ___

Notlar:
- Test cihazı (CPU/RAM):
- Chrome sürümü:
- Video bitrate:
```
