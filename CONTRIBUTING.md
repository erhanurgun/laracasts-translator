# Katkıda Bulunma Rehberi

Laracasts Translator projesine katkıda bulunmak istediğiniz için teşekkürler! Bu rehber, katkı sürecini kolaylaştırmak için hazırlanmıştır.

---

## Geliştirme Ortamı Kurulumu

1. Repoyu fork edin ve klonlayın:
   ```bash
   git clone https://github.com/<kullanici-adiniz>/laracasts-translator.git
   cd laracasts-translator
   ```

2. Chrome'da `chrome://extensions` adresine gidin

3. **Geliştirici modu**'nu açın ve **Paketlenmemiş yükle** ile proje klasörünü seçin

4. Kod değişikliklerinden sonra:
   - Eklenti kartındaki **yenile** butonuna basın
   - Content script değişikliklerinde hedef sekmeyi yenileyin
   - Service Worker (`background.js`) değişikliklerinde eklentiyi yeniden yükleyin

> Bu proje build sistemi veya paket yöneticisi kullanmaz. Saf vanilla JavaScript ile geliştirilmiştir.

---

## Kod Kuralları

- **Dil:** Tüm kod yorumları, UI metinleri ve log mesajları **Türkçe** yazılır
- **Karakter kodlaması:** Türkçe karakterler (ç, ğ, ı, ö, ş, ü, İ, Ş vb.) her zaman UTF-8 olarak korunur, ASCII'ye dönüştürülmez
- **Framework yok:** Saf vanilla JavaScript kullanılır, harici kütüphane eklenmez
- **İzolasyon:** Content script'ler IIFE ile izole edilir
- **API:** Chrome Extension Manifest V3 API'leri kullanılır (Service Worker, `chrome.storage`, `chrome.alarms`)
- **Prensipler:** SOLID, DRY, KISS, YAGNI

---

## Commit Mesajları

Commit mesajları Türkçe yazılır ve aşağıdaki formata uyulur:

```
<tip>: <kısa açıklama>

<isteğe bağlı detaylı açıklama>
```

### Tip Örnekleri

| Tip | Kullanım |
|-----|----------|
| `özellik` | Yeni özellik ekleme |
| `düzeltme` | Hata düzeltme |
| `iyileştirme` | Mevcut özelliği geliştirme |
| `refaktör` | Davranışı değiştirmeyen kod düzenlemesi |
| `belge` | Dokümantasyon değişiklikleri |
| `stil` | Kod biçimlendirme (boşluk, noktalama vb.) |

### Örnekler

```
özellik: Çeviri ilerleme göstergesi eklendi
düzeltme: SPA navigasyonunda çeviri durumunun sıfırlanması sorunu giderildi
belge: README'ye kurulum adımları eklendi
```

---

## Issue Oluşturma

- Hata raporları için **Hata Raporu** şablonunu kullanın
- Özellik önerileri için **Özellik Önerisi** şablonunu kullanın
- Mümkünse ekran görüntüsü veya konsol çıktısı ekleyin
- Chrome sürümünüzü ve işletim sisteminizi belirtin

---

## Pull Request Gönderme

1. Kendi fork'unuzda yeni bir dal oluşturun:
   ```bash
   git checkout -b ozellik/yeni-ozellik-adi
   ```

2. Değişikliklerinizi yapın ve commit edin

3. Fork'unuza push edin:
   ```bash
   git push origin ozellik/yeni-ozellik-adi
   ```

4. GitHub üzerinden Pull Request oluşturun:
   - PR şablonunu doldurun
   - İlgili issue varsa referans verin
   - Değişikliklerinizi açıklayın

### PR Kontrol Listesi

- [ ] Kod kurallarına uyuldu
- [ ] Türkçe karakterler korundu
- [ ] Manuel test yapıldı (en az bir Laracasts videosunda)
- [ ] Commit mesajları kurallara uygun
- [ ] Mevcut işlevsellik bozulmadı

---

## Test Rehberi

Bu projede otomatik test framework'ü yoktur. Manuel test aşağıdaki adımlarla yapılır:

1. Eklentiyi Chrome'a yükleyin
2. Geçerli bir OpenAI API key girin
3. [laracasts.com](https://laracasts.com) üzerinde bir video açın
4. Aşağıdaki senaryoları kontrol edin:
   - Çevirinin başarıyla tamamlanması
   - Çift altyazı gösteriminin doğru çalışması
   - Popup ayarlarının anında uygulanması
   - Önbelleğin doğru çalışması (aynı videoyu tekrar açın)
   - SPA navigasyonunda çevirinin devam etmesi
5. Chrome DevTools Console'da hata olmadığını doğrulayın

---

## Sorularınız mı var?

Herhangi bir sorunuz varsa [Issues](https://github.com/erhanurgun/laracasts-translator/issues) bölümünde yeni bir issue açabilirsiniz.
