/**
 * Content Script - Laracasts sayfasında çalışır
 * - Video element tespiti (DOM + Mux Player shadow DOM)
 * - Inertia transcriptSegments / Track / VTT yakalama
 * - Altyazı çeviri pipeline
 * - Overlay render ve senkronizasyon
 */

(function () {
  'use strict';

  // Tekrar çalışmayı önle
  if (window.__lctVideoLoaded) return;
  window.__lctVideoLoaded = true;

  let currentVideo = null;
  let currentContainer = null; // Mux Player gibi shadow DOM durumlarında overlay container
  let currentCues = [];       // [{startTime, endTime, text, translation}]
  let renderer = null;
  let settings = null;
  let isEnabled = true;
  let videoObserver = null;
  let syncListenerAttached = false;
  let navigationDebounce = null;
  let pageChangeTimeout = null;
  let findVideoObserver = null;
  let findVideoInterval = null;
  let videoCheckInterval = null;

  // waitForTracksOrTextTracks() resource takibi (cleanup'tan erişilebilmesi için module-scope)
  let waitTrackObserver = null;
  let waitTrackInterval = null;
  let waitTrackVideo = null;
  let waitTrackHandler = null;

  // Çeviri state yönetimi
  let lastVttUrl = null;
  let parsedOriginalCues = [];
  let translationState = 'idle'; // idle | pending_key | translating | done | error
  let statusMessage = null;      // Aktif durum mesajı (ilerleme, tamamlandı, hata)
  let activeTranslationPort = null;
  let translationEpoch = 0;
  let translationRetryCount = 0;
  const MAX_TRANSLATION_RETRIES = 2;
  let translationProgress = { current: 0, total: 0 };

  // Cache fingerprint hesaplama (background.js ile aynı algoritma — değişirse her ikisi güncellenmeli)
  function createFingerprint(cues) {
    const allText = cues.map(c => c.text).join('|');
    let hash = 0;
    for (let i = 0; i < allText.length; i++) {
      hash = ((hash << 5) - hash + allText.charCodeAt(i)) | 0;
    }
    return `v2:${cues.length}:${hash}`;
  }

  // --- Başlat ---

  async function init() {
    settings = await getSettings();
    isEnabled = settings.enabled;
    listenForMessages();
    watchForNavigation();
    if (!isEnabled) return;
    findVideo();
  }

  // --- SPA Navigasyon Algılama ---

  /**
   * Inertia SPA navigasyonunu algılar.
   * history.pushState/replaceState intercept + popstate event.
   * Not: content-laracasts.js de pushState patch'liyor; script yükleme sırasına göre
   * content-player.js ÖNCE patch'ler, content-laracasts.js üzerine patch'ler.
   * Her wrapper bir öncekini apply ile çağırdığı için chain doğru çalışır.
   */
  function watchForNavigation() {
    let lastUrl = location.href;

    const onUrlChange = () => {
      const newUrl = location.href;
      if (newUrl === lastUrl) return;
      lastUrl = newUrl;
      onPageChanged();
    };

    // Inertia SPA navigasyon algılama:
    // Inertia pushState → URL güncellenir → Vue DOM'u re-render eder →
    // MutationObserver tetiklenir → location.href kontrolü → navigasyon algılanır.
    // Not: pushState intercept isolated world nedeniyle çalışmaz.
    const navObserver = new MutationObserver(onUrlChange);
    navObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Browser back/forward
    window.addEventListener('popstate', () => {
      setTimeout(onUrlChange, 50);
    });
  }

  /**
   * Sayfa değiştiğinde eski state'i temizleyip yeni videoyu arar.
   */
  function onPageChanged() {
    clearTimeout(navigationDebounce);
    clearTimeout(pageChangeTimeout);
    cleanup();
    pageChangeTimeout = setTimeout(async () => {
      pageChangeTimeout = null;
      settings = await getSettings();
      isEnabled = settings.enabled;
      if (isEnabled) findVideo();
    }, 800);
  }

  // --- Video Element Tespiti ---

  /**
   * Video elemanını arar: önce doğrudan DOM, sonra Mux Player shadow DOM.
   * container: overlay'in ekleneceği yer (shadow DOM dışı eleman).
   */
  function findVideoElement() {
    // 1) Doğrudan DOM'da video
    let video = document.querySelector('video');
    if (video) return { video, container: null };

    // 2) Mux Player
    const muxPlayer = document.querySelector('mux-player');
    if (muxPlayer) {
      // 2a) Resmi API: media.nativeEl (en güvenilir yol)
      video = muxPlayer.media?.nativeEl;
      if (video && video.nodeName === 'VIDEO') {
        return { video, container: muxPlayer };
      }

      // 2b) Özyinelemeli shadow DOM taraması (API henüz hazır değilse)
      video = deepQuerySelector(muxPlayer, 'video');
      if (video) return { video, container: muxPlayer };
    }

    return null;
  }

  /**
   * İç içe shadow DOM'larda element arar (BFS, maks 5 seviye).
   * Mux Player gibi çok katmanlı web component'ler için gerekli.
   */
  function deepQuerySelector(host, selector, maxDepth = 5) {
    const roots = [];
    if (host.shadowRoot) roots.push(host.shadowRoot);

    for (let depth = 0; depth < maxDepth && roots.length > 0; depth++) {
      const nextRoots = [];
      for (const root of roots) {
        const found = root.querySelector(selector);
        if (found) return found;

        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) nextRoots.push(el.shadowRoot);
        }
      }
      roots.length = 0;
      roots.push(...nextRoots);
    }

    return null;
  }

  function findVideo() {
    // Önceki aramayı temizle
    if (findVideoObserver) { findVideoObserver.disconnect(); findVideoObserver = null; }
    if (findVideoInterval) { clearInterval(findVideoInterval); findVideoInterval = null; }

    let attempts = 0;
    const maxAttempts = 30;

    const check = () => {
      const result = findVideoElement();
      if (result) {
        if (findVideoObserver) { findVideoObserver.disconnect(); findVideoObserver = null; }
        if (findVideoInterval) { clearInterval(findVideoInterval); findVideoInterval = null; }
        onVideoFound(result.video, result.container);
        return true;
      }
      attempts++;
      return false;
    };

    if (check()) return;

    // MutationObserver + polling kombinasyonu
    findVideoObserver = new MutationObserver(() => {
      if (!currentVideo) check();
    });

    findVideoObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Yedek polling (shadow DOM içindeki değişiklikler MutationObserver'a yansımaz)
    findVideoInterval = setInterval(() => {
      if (currentVideo) {
        clearInterval(findVideoInterval); findVideoInterval = null;
        if (findVideoObserver) { findVideoObserver.disconnect(); findVideoObserver = null; }
        return;
      }
      if (check()) return;
      if (attempts >= maxAttempts) {
        clearInterval(findVideoInterval); findVideoInterval = null;
        if (findVideoObserver) { findVideoObserver.disconnect(); findVideoObserver = null; }
        console.log('LCT: Video bulunamadı (timeout)');
      }
    }, 500);
  }

  async function onVideoFound(video, container) {
    if (currentVideo === video) return;
    console.log('LCT: Video bulundu' + (container ? ' (Mux Player shadow DOM)' : ''));
    currentVideo = video;
    currentContainer = container || null;

    hideCCButton();

    // Erken görsel geri bildirim: kullanıcı eklentinin çalıştığını anında görsün
    ensureRenderer();
    showMessage('Altyazılar aranıyor...');

    // 0) Laracasts Inertia transcriptSegments (en yüksek öncelik)
    const transcriptCues = await findTranscriptSegments();
    if (transcriptCues) {
      disableNativeTextTracks(video);
      await processCues(transcriptCues);
      watchVideoChanges(video);
      return;
    }

    // 1) DOM <track> elemanlarından VTT URL dene
    const vttUrl = findVTTUrl(video);
    if (vttUrl) {
      disableNativeTextTracks(video);
      await processVTT(vttUrl);
      watchVideoChanges(video);
      return;
    }

    // 2) TextTrack API üzerinden cue'lara eriş
    //    (disableNativeTextTracks henüz çağrılmadı, cue'lara erişilebilir)
    const cues = findTextTrackCues(video);
    if (cues) {
      disableNativeTextTracks(video);
      await processCues(cues);
      watchVideoChanges(video);
      return;
    }

    // 3) Henüz yüklenmemiş olabilir, her iki kaynağı da bekle
    waitForTracksOrTextTracks(video);

    // Video src değişikliğini izle (ders geçişleri)
    watchVideoChanges(video);
  }

  let nativeTrackHandlers = null;
  let ccHideStyle = null;

  function disableNativeTextTracks(video) {
    function disableAll() {
      for (let i = 0; i < video.textTracks.length; i++) {
        if (video.textTracks[i].mode !== 'disabled') {
          video.textTracks[i].mode = 'disabled';
        }
      }
    }

    disableAll();
    video.textTracks.addEventListener('addtrack', disableAll);
    video.textTracks.addEventListener('change', disableAll);

    nativeTrackHandlers = { target: video.textTracks, handler: disableAll };
  }

  function enableNativeTextTracks(video) {
    if (nativeTrackHandlers) {
      nativeTrackHandlers.target.removeEventListener('addtrack', nativeTrackHandlers.handler);
      nativeTrackHandlers.target.removeEventListener('change', nativeTrackHandlers.handler);
      nativeTrackHandlers = null;
    }
    if (video) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'showing';
      }
    }
  }

  function hideCCButton() {
    if (ccHideStyle) return;
    ccHideStyle = document.createElement('style');
    ccHideStyle.id = 'lct-hide-cc';
    ccHideStyle.textContent = `
      button[aria-label*="aption"],
      button[data-title="captions"],
      .cc-button,
      [class*="CaptionsButton"],
      [class*="captions-button"],
      mux-player::part(captions-button),
      [slot="captions-button"] {
        display: none !important;
      }
    `;
    document.head.appendChild(ccHideStyle);
  }

  function showCCButton() {
    if (ccHideStyle) {
      ccHideStyle.remove();
      ccHideStyle = null;
    }
  }

  function findVTTUrl(video) {
    const tracks = video.querySelectorAll('track');
    for (const track of tracks) {
      // İngilizce altyazı tercih et
      if (track.src && (track.srclang === 'en' || track.kind === 'captions' || track.kind === 'subtitles')) {
        return track.src;
      }
    }
    // Herhangi bir track al
    for (const track of tracks) {
      if (track.src) return track.src;
    }
    return null;
  }

  /**
   * Bazı player'lar altyazıları DOM'a <track> elemanı olarak eklemez;
   * JavaScript TextTrack API ile programatik yükler.
   * Bu fonksiyon video.textTracks üzerinden cue'lara erişir.
   */
  function findTextTrackCues(video) {
    const textTracks = video.textTracks;
    if (!textTracks || textTracks.length === 0) return null;

    // Öncelik: İngilizce captions/subtitles
    let targetTrack = null;
    for (let i = 0; i < textTracks.length; i++) {
      const track = textTracks[i];
      if (track.language === 'en' && (track.kind === 'captions' || track.kind === 'subtitles')) {
        targetTrack = track;
        break;
      }
    }

    // İngilizce bulunamadıysa herhangi bir captions/subtitles track'i al
    if (!targetTrack) {
      for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];
        if (track.kind === 'captions' || track.kind === 'subtitles') {
          targetTrack = track;
          break;
        }
      }
    }

    // Hiçbir uygun track yoksa ilk track'i dene
    if (!targetTrack && textTracks.length > 0) {
      targetTrack = textTracks[0];
    }

    if (!targetTrack) return null;

    // Cue'lara erişmek için mode geçici olarak 'hidden' olmalı
    // ('disabled' modda cues property null döner)
    const originalMode = targetTrack.mode;
    if (targetTrack.mode === 'disabled') {
      targetTrack.mode = 'hidden';
    }

    const cues = targetTrack.cues;
    if (!cues || cues.length === 0) {
      targetTrack.mode = originalMode;
      return null;
    }

    // Cue'ları VTT parser çıktısıyla uyumlu formata dönüştür
    const result = [];
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      result.push({
        id: cue.id || String(i + 1),
        startTime: cue.startTime,
        endTime: cue.endTime,
        text: cue.text
      });
    }

    // Native track'i tekrar kapat (kendi overlay'imizi kullanacağız)
    targetTrack.mode = 'disabled';

    console.log(`LCT: TextTrack API ile ${result.length} cue bulundu (lang: ${targetTrack.language || 'bilinmiyor'})`);
    return result;
  }

  /**
   * Stale data-page durumunda mevcut URL'e GET request atıp
   * taze Inertia page data'sını çeker.
   */
  async function fetchFreshPageData() {
    try {
      const resp = await fetch(location.href);
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const pageEl = doc.querySelector('[data-page]');
      if (!pageEl) return null;
      return JSON.parse(pageEl.getAttribute('data-page'));
    } catch (e) {
      console.warn('LCT: Sayfa verisi çekme hatası:', e);
      return null;
    }
  }

  /**
   * Inertia data-page prop'larından transcriptSegments verisini çıkarır.
   * Laracasts, Mux geçişiyle transcript'leri sayfaya JSON olarak gömüyor.
   */
  async function findTranscriptSegments() {
    if (!window.location.hostname.includes('laracasts.com')) return null;
    try {
      const pageEl = document.querySelector('[data-page]');
      if (!pageEl) return null;
      const dataPage = pageEl.getAttribute('data-page');
      if (!dataPage) return null;
      let pageData = JSON.parse(dataPage);

      // Stale data-page kontrolü: Inertia url alanı vs mevcut URL
      if (pageData.url && pageData.url !== location.pathname) {
        console.log('LCT: data-page stale, sayfa verisi yeniden çekiliyor');
        pageData = await fetchFreshPageData();
        if (!pageData) return null;
      }

      // transcriptSegments doğrudan props içinde veya iç içe olabilir
      const segments = findDeep(pageData.props, 'transcriptSegments');
      if (!Array.isArray(segments) || segments.length === 0) return null;
      console.log('LCT DEBUG: İlk segment örneği:', JSON.stringify(segments[0]));
      console.log(`LCT: Inertia transcriptSegments'den ${segments.length} segment bulundu`);
      const mapped = segments.map((seg, i) => ({
        id: String(seg.id || i + 1),
        startTime: seg.startTime,
        endTime: seg.endTime,
        text: seg.text.replace(/<[^>]*>/g, '')
      }));
      const sentenceCues = mapped.flatMap(seg => splitSegmentToSentences(seg));
      const cues = sentenceCues.flatMap(c => splitLongCue(c));
      console.log(`LCT: Cümle bazlı parçalama sonrası ${cues.length} cue oluştu`);
      return cues;
    } catch (e) {
      console.warn('LCT: transcriptSegments parse hatası:', e);
      return null;
    }
  }

  /**
   * Paragraf bazlı segment'i cümle sınırlarından böler.
   * Her cümleye karakter oranına göre zaman aralığı dağıtır.
   * Zamanlama bilgisi yoksa veya tek cümle ise segment'i olduğu gibi döndürür.
   */
  function splitSegmentToSentences(segment) {
    const { startTime, endTime, text, id } = segment;

    // Zamanlama yoksa veya geçersizse bölme
    if (typeof startTime !== 'number' || typeof endTime !== 'number') {
      return [segment];
    }

    // Cümle sınırlarından böl: noktalama + boşluk + büyük harf
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 0);

    // Tek cümle veya bölünemedi ise olduğu gibi döndür
    if (sentences.length <= 1) {
      return [segment];
    }

    // Kısa parçaları (< 10 karakter) bir öncekiyle birleştir
    const merged = [sentences[0]];
    for (let i = 1; i < sentences.length; i++) {
      if (sentences[i].length < 10) {
        merged[merged.length - 1] += ' ' + sentences[i];
      } else {
        merged.push(sentences[i]);
      }
    }

    // Birleştirme sonrası tek cümle kaldıysa
    if (merged.length <= 1) {
      return [segment];
    }

    // Toplam karakter sayısı üzerinden zaman dağıtımı
    const totalChars = merged.reduce((sum, s) => sum + s.length, 0);
    const duration = endTime - startTime;
    let currentStart = startTime;

    return merged.map((sentence, i) => {
      const ratio = sentence.length / totalChars;
      const sentenceDuration = duration * ratio;
      const sentenceStart = currentStart;
      const sentenceEnd = (i === merged.length - 1) ? endTime : currentStart + sentenceDuration;
      currentStart = sentenceEnd;

      return {
        id: `${id}_${i + 1}`,
        startTime: Math.round(sentenceStart * 1000) / 1000,
        endTime: Math.round(sentenceEnd * 1000) / 1000,
        text: sentence.trim()
      };
    });
  }

  /**
   * 70+ karakter uzunluğundaki cue'ları doğal kırılma noktalarından böler.
   * Virgül veya bağlaçtan (and, or, but, so, that, which vb.) ortaya en yakın
   * noktada ikiye böler. Kırılma noktası yoksa en yakın boşluktan böler.
   * Recursive: parçalar hâlâ uzunsa tekrar böler.
   * Zaman dağılımı karakter oranıyla yapılır.
   */
  function splitLongCue(cue, maxLen = 70) {
    if (cue.text.length <= maxLen) return [cue];

    const text = cue.text;
    const mid = Math.floor(text.length / 2);

    // Kırılma noktası bul: virgül veya bağlaç (ortaya en yakın)
    const breakPattern = /,\s|\s(?:and|or|but|so|that|which|where|when|because|if|while|after|before|since)\s/gi;
    let bestPos = -1;
    let bestDist = Infinity;
    let match;

    while ((match = breakPattern.exec(text)) !== null) {
      const pos = match.index + match[0].indexOf(' ');
      const dist = Math.abs(pos - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = pos;
      }
    }

    // Kırılma noktası yoksa en yakın boşluktan böl
    if (bestPos === -1) {
      for (let offset = 0; offset < mid; offset++) {
        if (text[mid + offset] === ' ') { bestPos = mid + offset; break; }
        if (text[mid - offset] === ' ') { bestPos = mid - offset; break; }
      }
    }

    // Hiç boşluk yoksa (çok nadir) olduğu gibi döndür
    if (bestPos <= 0 || bestPos >= text.length - 1) return [cue];

    const part1Text = text.slice(0, bestPos).trim();
    const part2Text = text.slice(bestPos).trim();

    if (!part1Text || !part2Text) return [cue];

    // Zaman dağılımı karakter oranıyla
    const totalChars = part1Text.length + part2Text.length;
    const duration = cue.endTime - cue.startTime;
    const splitTime = cue.startTime + duration * (part1Text.length / totalChars);

    const part1 = {
      id: cue.id + '_a',
      startTime: Math.round(cue.startTime * 1000) / 1000,
      endTime: Math.round(splitTime * 1000) / 1000,
      text: part1Text
    };
    const part2 = {
      id: cue.id + '_b',
      startTime: Math.round(splitTime * 1000) / 1000,
      endTime: Math.round(cue.endTime * 1000) / 1000,
      text: part2Text
    };

    // Recursive: parçalar hâlâ uzunsa tekrar böl
    return [...splitLongCue(part1, maxLen), ...splitLongCue(part2, maxLen)];
  }

  /**
   * Obje ağacında bir anahtarı özyinelemeli arar.
   * Inertia prop yapısı farklı derinliklerde olabilir (props.lesson.transcriptSegments vb.)
   */
  function findDeep(obj, key) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[key]) return obj[key];
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') {
        const found = findDeep(v, key);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * waitForTracksOrTextTracks() tarafından oluşturulan observer/interval/handler'ları temizler.
   * Module-scope değişkenler sayesinde cleanup()'tan da erişilebilir — orphan resource sızıntısını önler.
   */
  function cleanupWaitTrack() {
    if (waitTrackObserver) { waitTrackObserver.disconnect(); waitTrackObserver = null; }
    if (waitTrackInterval) { clearInterval(waitTrackInterval); waitTrackInterval = null; }
    if (waitTrackVideo && waitTrackHandler) {
      waitTrackVideo.textTracks.removeEventListener('addtrack', waitTrackHandler);
    }
    waitTrackVideo = null;
    waitTrackHandler = null;
  }

  function waitForTracksOrTextTracks(video) {
    // Önceki beklemeyi temizle (SPA navigasyon sonrası yetim kalmasın)
    cleanupWaitTrack();

    let resolved = false;
    let trackAttempts = 0;
    const maxAttempts = 30; // 30 saniye (1sn aralık)

    waitTrackVideo = video;

    function done() {
      if (resolved) return false;
      resolved = true;
      cleanupWaitTrack();
      return true;
    }

    // 1) DOM <track> elemanları için MutationObserver
    waitTrackObserver = new MutationObserver(() => {
      if (resolved) return;
      const url = findVTTUrl(video);
      if (url && done()) {
        processVTT(url);
      }
    });
    waitTrackObserver.observe(video, { childList: true, subtree: true });

    // 2) TextTrack API: addtrack event'i
    waitTrackHandler = function onAddTrack() {
      if (resolved) return;
      const cues = findTextTrackCues(video);
      if (cues && done()) {
        disableNativeTextTracks(video);
        processCues(cues);
      }
    };
    video.textTracks.addEventListener('addtrack', waitTrackHandler);

    // 3) Yedek polling - her iki kaynağı da kontrol eder
    waitTrackInterval = setInterval(() => {
      if (resolved) return;
      trackAttempts++;

      // DOM <track> dene
      const url = findVTTUrl(video);
      if (url && done()) {
        processVTT(url);
        return;
      }

      // TextTrack API dene
      const cues = findTextTrackCues(video);
      if (cues && done()) {
        disableNativeTextTracks(video);
        processCues(cues);
        return;
      }

      if (trackAttempts >= maxAttempts) {
        done();
        console.log('LCT: Track bulunamadı (30sn timeout)');
        showMessage('Bu video için altyazı bulunamadı');
      }
    }, 1000);
  }

  // --- VTT İşleme Pipeline ---

  /**
   * TextTrack API'den gelen cue dizisini doğrudan işler.
   * VTT fetch/parse adımını atlar; geri kalan pipeline aynıdır.
   */
  async function processCues(cues) {
    console.log(`LCT: ${cues.length} cue doğrudan işleniyor (TextTrack API)`);
    translationEpoch++;

    try {
      if (cues.length === 0) {
        showMessage('Altyazı bulunamadı');
        return;
      }

      // Cue'ları startTime'a göre sırala ve uzun olanları böl
      cues.sort((a, b) => a.startTime - b.startTime);
      cues = cues.flatMap(c => splitLongCue(c));

      // State'e kaydet
      lastVttUrl = null;
      parsedOriginalCues = cues;

      // Renderer oluştur
      ensureRenderer();

      // Orijinal cue'larla sync başlat
      currentCues = cues.map(c => ({ ...c, translation: '' }));
      startSync();

      // API key kontrolü
      if (!settings.hasApiKey) {
        translationState = 'pending_key';
        showMessage('API key gerekli - Eklenti ayarlarından girin');
        console.log('LCT: API key yok, çeviri beklemede');
        return;
      }

      // Çeviriyi başlat (önce cache kontrol)
      await checkCacheAndTranslate();

    } catch (err) {
      console.error('LCT: Pipeline hatası:', err);
      translationState = 'error';
      showMessage('Bir hata oluştu');
    }
  }

  async function processVTT(vttUrl) {
    console.log('LCT: VTT URL:', vttUrl);
    translationEpoch++;

    try {
      // VTT içeriğini al
      const vttText = await fetchVTT(vttUrl);
      if (!vttText) {
        showMessage('Altyazı dosyası yüklenemedi');
        return;
      }

      // Parse et
      let cues = VTTParser.parse(vttText);
      if (cues.length === 0) {
        showMessage('Altyazı bulunamadı');
        return;
      }

      console.log(`LCT: ${cues.length} altyazı satırı bulundu`);

      // Cue'ları startTime'a göre sırala ve uzun olanları böl
      cues.sort((a, b) => a.startTime - b.startTime);
      cues = cues.flatMap(c => splitLongCue(c));

      // State'e kaydet
      lastVttUrl = vttUrl;
      parsedOriginalCues = cues;

      // Renderer oluştur
      ensureRenderer();

      // Orijinal cue'larla sync başlat
      currentCues = cues.map(c => ({ ...c, translation: '' }));
      startSync();

      // API key kontrolü
      if (!settings.hasApiKey) {
        translationState = 'pending_key';
        showMessage('API key gerekli - Eklenti ayarlarından girin');
        console.log('LCT: API key yok, çeviri beklemede');
        return;
      }

      // Çeviriyi başlat (önce cache kontrol)
      await checkCacheAndTranslate();

    } catch (err) {
      console.error('LCT: Pipeline hatası:', err);
      translationState = 'error';
      showMessage('Bir hata oluştu');
    }
  }

  async function checkCacheAndTranslate() {
    if (parsedOriginalCues.length === 0) return;

    const videoId = extractVideoId();
    const cacheKey = `translation_${videoId}_tr`;

    try {
      const result = await chrome.storage.local.get(cacheKey);
      const cached = result[cacheKey];

      if (cached && cached.cues && cached.cues.length === parsedOriginalCues.length) {
        const fingerprint = createFingerprint(parsedOriginalCues);
        if (cached.fingerprint === fingerprint) {
          console.log('LCT: Cache hit — çeviriler önbellekten yükleniyor');
          currentCues = cached.cues;
          translationState = 'done';
          translationRetryCount = 0;
          showMessage('Önbellekten yüklendi');
          setTimeout(() => { if (translationState === 'done') showMessage(''); }, 2000);
          return;
        }
        console.log('LCT: Cache fingerprint uyuşmuyor, yeniden çevriliyor');
      }
    } catch (e) {
      console.warn('LCT: Cache ön kontrolü hatası:', e);
    }

    triggerTranslation();
  }

  function triggerTranslation() {
    if (parsedOriginalCues.length === 0) return;

    // Önceki çeviriyi iptal et
    if (activeTranslationPort) {
      try { activeTranslationPort.disconnect(); } catch (_) {}
      activeTranslationPort = null;
    }

    translationState = 'translating';
    showMessage('Çeviriliyor...');

    const epoch = translationEpoch;
    const videoId = extractVideoId();
    const port = chrome.runtime.connect({ name: 'translate' });
    activeTranslationPort = port;

    port.onMessage.addListener((msg) => {
      // Stale çeviri kontrolü - epoch değiştiyse sonucu at
      if (epoch !== translationEpoch) return;

      if (msg.type === 'PROGRESS') {
        translationProgress = { current: msg.current, total: msg.total };
        if (msg.cached) {
          showMessage('Önbellekten yükleniyor...');
        } else if (!hasPartialTranslation()) {
          // İlk batch henüz gelmedi → statusMessage ile ilerleme göster
          showMessage(`Çevriliyor... (${msg.current}/${msg.total})`);
        }
        // İlk batch geldiyse → statusMessage set etme, onTimeUpdate halleder
      } else if (msg.type === 'BATCH_RESULT') {
        // Progresif batch: çevirileri anında uygula
        const { startIndex, cues: batchCues } = msg;
        for (let i = 0; i < batchCues.length; i++) {
          if (currentCues[startIndex + i]) {
            currentCues[startIndex + i].translation = batchCues[i].translation;
          }
        }
        console.log(`LCT: Batch ${Math.floor(startIndex / 50) + 1} uygulandı (index ${startIndex}-${startIndex + batchCues.length - 1})`);
        // İlk batch geldi → normal render moduna geç
        statusMessage = null;
      } else if (msg.type === 'COMPLETE') {
        currentCues = msg.cues;
        translationState = 'done';
        translationRetryCount = 0; // Başarılı: retry sayacını sıfırla
        activeTranslationPort = null;
        try { port.disconnect(); } catch (_) {}
        console.log('LCT: Çeviri tamamlandı');

        // Ekranda aktif cue varsa → anında TR çevirisini göster
        const time = currentVideo?.currentTime || 0;
        const activeCue = findActiveCue(time);
        if (activeCue) {
          statusMessage = null;
          renderer.update(
            settings.showOriginal ? activeCue.text : '',
            settings.showTranslation ? (activeCue.translation || '') : ''
          );
        } else {
          showMessage('Çeviri tamamlandı!');

          // Video oynatılıyorsa: 5sn sonra temizle
          // Video durmuşsa: play/seeked event'ine kadar bekle
          if (currentVideo.paused) {
            const clearOnResume = () => {
              setTimeout(() => { if (translationState === 'done') showMessage(''); }, 3000);
              currentVideo.removeEventListener('playing', clearOnResume);
              currentVideo.removeEventListener('seeked', clearOnResume);
            };
            currentVideo.addEventListener('playing', clearOnResume, { once: true });
            currentVideo.addEventListener('seeked', clearOnResume, { once: true });
          } else {
            setTimeout(() => { if (translationState === 'done') showMessage(''); }, 5000);
          }
        }
      } else if (msg.type === 'ERROR') {
        console.warn('LCT: Çeviri hatası:', msg.error);
        translationState = 'error';
        activeTranslationPort = null;
        showMessage(msg.error);
        try { port.disconnect(); } catch (_) {}
      }
    });

    port.onDisconnect.addListener(() => {
      // Port beklenmedik şekilde kapandıysa ve hâlâ translating durumdaysa
      if (translationState === 'translating' && epoch === translationEpoch) {
        activeTranslationPort = null;

        if (translationRetryCount < MAX_TRANSLATION_RETRIES) {
          translationRetryCount++;
          console.warn(`LCT: Bağlantı koptu, yeniden deneniyor (${translationRetryCount}/${MAX_TRANSLATION_RETRIES})`);
          showMessage(`Bağlantı koptu, yeniden deneniyor (${translationRetryCount}/${MAX_TRANSLATION_RETRIES})...`);
          setTimeout(() => {
            if (epoch === translationEpoch) triggerTranslation();
          }, 2000);
        } else {
          translationState = 'error';
          showMessage('Bağlantı koptu (yeniden denemeler tükendi)');
        }
      }
    });

    port.postMessage({ type: 'TRANSLATE_CUES', cues: parsedOriginalCues, videoId });
  }

  async function fetchVTT(url) {
    try {
      // Önce direkt fetch dene
      const resp = await fetch(url);
      if (resp.ok) return resp.text();
    } catch (e) {
      // CORS hatası - background üzerinden dene
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_VTT',
        url: url
      });
      if (response && response.success) return response.text;
    } catch (e) {
      console.error('LCT: VTT fetch hatası:', e);
    }

    return null;
  }

  function extractVideoId() {
    // 1) Mux Player: playback-id attribute
    const muxPlayer = document.querySelector('mux-player');
    if (muxPlayer) {
      const playbackId = muxPlayer.getAttribute('playback-id');
      if (playbackId) return playbackId;
    }

    // 2) Laracasts URL'sinden ders bilgisi
    const pathMatch = window.location.pathname.match(/\/episodes\/(\d+)/);
    if (pathMatch) return `laracasts_${pathMatch[1]}`;

    // 3) Video ID fallback
    const videoPathMatch = window.location.pathname.match(/\/video\/(\d+)/);
    if (videoPathMatch) return videoPathMatch[1];

    // 4) Son çare
    const params = new URLSearchParams(window.location.search);
    return params.get('clip_id') || window.location.pathname.replace(/\//g, '_') || 'unknown';
  }

  // --- Senkronizasyon ---

  function startSync() {
    if (!currentVideo) return;

    // Duplicate listener kontrolü
    if (syncListenerAttached) return;
    syncListenerAttached = true;

    currentVideo.addEventListener('timeupdate', onTimeUpdate);
  }

  function onTimeUpdate() {
    if (!currentVideo || !renderer || !isEnabled) return;

    const time = currentVideo.currentTime;
    const activeCue = findActiveCue(time);

    // Progresif çeviri: ilk batch geldikten sonra normal altyazı + boşluklarda ilerleme
    if (translationState === 'translating' && hasPartialTranslation()) {
      if (activeCue) {
        renderer.update(
          settings.showOriginal ? activeCue.text : '',
          settings.showTranslation ? (activeCue.translation || '') : ''
        );
      } else {
        renderer.update('', `Çevriliyor... (${translationProgress.current}/${translationProgress.total})`);
      }
      return;
    }

    // Durum mesajı aktifken: mesajı koru, sadece EN altyazıyı güncelle
    if (statusMessage) {
      if (translationState === 'translating') {
        const originalText = (activeCue && settings.showOriginal) ? activeCue.text : '';
        renderer.update(originalText, statusMessage);
      }
      return;
    }

    // Normal altyazı gösterimi
    if (activeCue) {
      renderer.update(
        settings.showOriginal ? activeCue.text : '',
        settings.showTranslation ? (activeCue.translation || '') : ''
      );
    } else {
      renderer.update('', '');
    }
  }

  function hasPartialTranslation() {
    return currentCues.some(c => c.translation !== '');
  }

  /**
   * Binary search ile aktif cue bulma
   * Kesin zaman eşleşmesi - tolerans yok
   */
  function findActiveCue(time) {
    const cues = currentCues;
    if (!cues || cues.length === 0) return null;

    let low = 0;
    let high = cues.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const cue = cues[mid];

      if (time < cue.startTime) {
        high = mid - 1;
      } else if (time > cue.endTime) {
        low = mid + 1;
      } else {
        return cue;
      }
    }

    return null;
  }

  // --- Renderer ---

  function ensureRenderer() {
    if (renderer) renderer.destroy();
    renderer = createSubtitleRenderer(currentVideo, settings, currentContainer);
  }

  function showMessage(msg) {
    statusMessage = msg || null;
    if (!renderer && currentVideo) ensureRenderer();
    if (!renderer) return;

    if (statusMessage) {
      if (translationState === 'translating') {
        // Çeviri sırasında: EN altyazı + durum mesajı birlikte göster
        const time = currentVideo?.currentTime || 0;
        const activeCue = findActiveCue(time);
        const originalText = (activeCue && settings.showOriginal) ? activeCue.text : '';
        renderer.update(originalText, statusMessage);
      } else {
        renderer.update('', statusMessage);
      }
    }
    // statusMessage null ise: bir sonraki timeupdate normal gösterir
  }

  // --- Video Değişiklik İzleme ---

  function watchVideoChanges(video) {
    if (videoObserver) videoObserver.disconnect();
    if (videoCheckInterval) { clearInterval(videoCheckInterval); videoCheckInterval = null; }

    videoObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' &&
            (mutation.attributeName === 'src' || mutation.attributeName === 'playback-id')) {
          console.log(`LCT: ${mutation.attributeName} değişti, yeniden başlatılıyor`);
          const prevContainer = currentContainer;
          cleanup();
          setTimeout(() => onVideoFound(video, prevContainer), 500);
          return;
        }
      }
    });

    videoObserver.observe(video, { attributes: true, attributeFilter: ['src'] });

    if (currentContainer && currentContainer.tagName === 'MUX-PLAYER') {
      videoObserver.observe(currentContainer, { attributes: true, attributeFilter: ['playback-id'] });

      // Mux Player video element değişimini izle (shadow DOM içerisinde swap olabilir)
      videoCheckInterval = setInterval(() => {
        const actualVideo = currentContainer.media?.nativeEl;
        if (actualVideo && actualVideo !== currentVideo) {
          console.log('LCT: Mux Player video element değişti, yeniden başlatılıyor');
          clearInterval(videoCheckInterval);
          videoCheckInterval = null;
          const prevContainer = currentContainer;
          cleanup();
          setTimeout(() => onVideoFound(actualVideo, prevContainer), 100);
        }
      }, 1000);
    }
  }

  function cleanup() {
    // waitForTracksOrTextTracks() resource temizliği (orphan observer/interval önleme)
    cleanupWaitTrack();
    // findVideo() observer/interval temizliği
    if (findVideoObserver) { findVideoObserver.disconnect(); findVideoObserver = null; }
    if (findVideoInterval) { clearInterval(findVideoInterval); findVideoInterval = null; }
    // Sayfa değişiklik timeout temizliği
    clearTimeout(pageChangeTimeout);
    pageChangeTimeout = null;
    // Mux Player video element swap kontrolü
    if (videoCheckInterval) { clearInterval(videoCheckInterval); videoCheckInterval = null; }
    // Aktif çeviri port'unu kapat
    if (activeTranslationPort) {
      activeTranslationPort.disconnect();
      activeTranslationPort = null;
    }
    // Video değişiklik observer'ını temizle (SPA navigasyonda yetim kalmasını önler)
    if (videoObserver) {
      videoObserver.disconnect();
      videoObserver = null;
    }
    if (currentVideo) {
      enableNativeTextTracks(currentVideo);
      showCCButton();
      currentVideo.removeEventListener('timeupdate', onTimeUpdate);
      currentVideo = null;
    }
    currentContainer = null;
    syncListenerAttached = false;
    statusMessage = null;
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    currentCues = [];
    parsedOriginalCues = [];
    translationState = 'idle';
    translationRetryCount = 0;
    translationProgress = { current: 0, total: 0 };
    lastVttUrl = null;
  }

  // --- Ayarlar & Mesajlar ---

  async function getSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response && response.success) return response.settings;
    } catch (e) {}

    // Fallback: doğrudan storage'dan oku
    try {
      const syncDefaults = {
        enabled: true,
        showOriginal: true,
        showTranslation: true,
        fontSize: 25,
        originalColor: '#ffffff',
        translationColor: '#ffd700',
        bgOpacity: 0.75
      };
      const syncSettings = await chrome.storage.sync.get(syncDefaults);
      const { _lct_apiKey } = await chrome.storage.local.get({ _lct_apiKey: '' });
      syncSettings.hasApiKey = !!_lct_apiKey;
      return syncSettings;
    } catch (e) {
      // Storage'a da erişilemezse hard-coded defaults
      return {
        enabled: true,
        showOriginal: true,
        showTranslation: true,
        fontSize: 25,
        originalColor: '#ffffff',
        translationColor: '#ffd700',
        bgOpacity: 0.75,
        hasApiKey: false
      };
    }
  }

  function listenForMessages() {
    // Birincil yöntem: chrome.storage.onChanged - iframe'lerde de çalışır
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' || (area === 'local' && changes._lct_apiKey)) {
        onSettingsChanged();
      }
    });

    // Yedek: runtime mesajları (top frame için)
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SETTINGS_CHANGED') {
        onSettingsChanged();
      }
    });
  }

  let settingsChangeDebounce = null;
  async function onSettingsChanged() {
    // Debounce: birden fazla storage key aynı anda değişebilir
    clearTimeout(settingsChangeDebounce);
    settingsChangeDebounce = setTimeout(async () => {
      settings = await getSettings();
      const wasEnabled = isEnabled;
      isEnabled = settings.enabled;

      if (!isEnabled) {
        cleanup();
        return;
      }

      if (!wasEnabled && isEnabled) {
        findVideo();
        return;
      }

      // Stil güncelle
      if (renderer) {
        renderer.updateStyle(settings);
      }

      // API key eklendiyse ve çeviri beklemedeyse → çeviriyi tetikle
      if (translationState === 'pending_key' && settings.hasApiKey && parsedOriginalCues.length > 0) {
        console.log('LCT: API key algılandı, çeviri başlatılıyor');
        triggerTranslation();
      }
    }, 100);
  }

  // --- Başlat ---
  init();
})();
