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

  // --- Başlat ---

  async function init() {
    settings = await getSettings();
    isEnabled = settings.enabled;
    if (!isEnabled) return;

    findVideo();
    listenForMessages();
  }

  // --- Video Element Tespiti ---

  /**
   * Video elemanını arar: önce doğrudan DOM, sonra Mux Player shadow DOM.
   * container: overlay'in ekleneceği yer (shadow DOM dışı eleman).
   */
  function findVideoElement() {
    // 1) Doğrudan DOM'da video (Vimeo iframe senaryosu)
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
    let attempts = 0;
    const maxAttempts = 30;

    const check = () => {
      const result = findVideoElement();
      if (result) {
        onVideoFound(result.video, result.container);
        return;
      }
      attempts++;
      if (attempts >= maxAttempts) {
        console.log('LCT: Video bulunamadı (timeout)');
        return;
      }
    };

    // Hemen kontrol et
    check();
    if (currentVideo) return;

    // MutationObserver + polling kombinasyonu
    const observer = new MutationObserver(() => {
      if (!currentVideo) {
        const result = findVideoElement();
        if (result) {
          observer.disconnect();
          onVideoFound(result.video, result.container);
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Yedek polling (shadow DOM içindeki değişiklikler MutationObserver'a yansımaz)
    const interval = setInterval(() => {
      if (currentVideo) {
        clearInterval(interval);
        observer.disconnect();
        return;
      }
      check();
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        observer.disconnect();
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
    const transcriptCues = findTranscriptSegments();
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
   * Vimeo, altyazıları DOM'a <track> elemanı olarak eklemez;
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
   * Inertia data-page prop'larından transcriptSegments verisini çıkarır.
   * Laracasts, Mux geçişiyle transcript'leri sayfaya JSON olarak gömüyor.
   */
  function findTranscriptSegments() {
    if (!window.location.hostname.includes('laracasts.com')) return null;
    try {
      const pageEl = document.querySelector('[data-page]');
      if (!pageEl) return null;
      const pageData = JSON.parse(pageEl.getAttribute('data-page'));
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
      const cues = mapped.flatMap(seg => splitSegmentToSentences(seg));
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

  function waitForTracksOrTextTracks(video) {
    let resolved = false;
    let trackAttempts = 0;
    const maxAttempts = 30; // 30 saniye (1sn aralık)

    function done() {
      if (resolved) return false;
      resolved = true;
      clearInterval(interval);
      trackObserver.disconnect();
      video.textTracks.removeEventListener('addtrack', onAddTrack);
      return true;
    }

    // 1) DOM <track> elemanları için MutationObserver
    const trackObserver = new MutationObserver(() => {
      if (resolved) return;
      const url = findVTTUrl(video);
      if (url && done()) {
        processVTT(url);
      }
    });
    trackObserver.observe(video, { childList: true, subtree: true });

    // 2) TextTrack API: addtrack event'i
    function onAddTrack() {
      if (resolved) return;
      // Yeni track eklendiğinde cue'ları kontrol et
      const cues = findTextTrackCues(video);
      if (cues && done()) {
        disableNativeTextTracks(video);
        processCues(cues);
      }
    }
    video.textTracks.addEventListener('addtrack', onAddTrack);

    // 3) Yedek polling - her iki kaynağı da kontrol eder
    const interval = setInterval(() => {
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

      // Cue'ları startTime'a göre sırala
      cues.sort((a, b) => a.startTime - b.startTime);

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

      // Çeviriyi başlat
      await triggerTranslation();

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
      const cues = VTTParser.parse(vttText);
      if (cues.length === 0) {
        showMessage('Altyazı bulunamadı');
        return;
      }

      console.log(`LCT: ${cues.length} altyazı satırı bulundu`);

      // Cue'ları startTime'a göre sırala (senkronizasyon güvenilirliği)
      cues.sort((a, b) => a.startTime - b.startTime);

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

      // Çeviriyi başlat
      await triggerTranslation();

    } catch (err) {
      console.error('LCT: Pipeline hatası:', err);
      translationState = 'error';
      showMessage('Bir hata oluştu');
    }
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

    // 3) Vimeo iframe fallback
    const vimeoMatch = window.location.pathname.match(/\/video\/(\d+)/);
    if (vimeoMatch) return vimeoMatch[1];

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

    // Mux Player container varsa playback-id değişikliğini de izle
    if (currentContainer && currentContainer.tagName === 'MUX-PLAYER') {
      videoObserver.observe(currentContainer, { attributes: true, attributeFilter: ['playback-id'] });
    }
  }

  function cleanup() {
    // Aktif çeviri port'unu kapat
    if (activeTranslationPort) {
      activeTranslationPort.disconnect();
      activeTranslationPort = null;
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
