/**
 * Content Script - Vimeo iframe içinde çalışır
 * - Video element tespiti
 * - Track/VTT yakalama
 * - Altyazı çeviri pipeline
 * - Overlay render ve senkronizasyon
 */

(function () {
  'use strict';

  // Tekrar çalışmayı önle
  if (window.__lctVimeoLoaded) return;
  window.__lctVimeoLoaded = true;

  let currentVideo = null;
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

  // --- Başlat ---

  async function init() {
    settings = await getSettings();
    isEnabled = settings.enabled;
    if (!isEnabled) return;

    findVideo();
    listenForMessages();
  }

  // --- Video Element Tespiti ---

  function findVideo() {
    let attempts = 0;
    const maxAttempts = 30;

    const check = () => {
      const video = document.querySelector('video');
      if (video) {
        onVideoFound(video);
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
        const video = document.querySelector('video');
        if (video) {
          observer.disconnect();
          onVideoFound(video);
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Yedek polling
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

  async function onVideoFound(video) {
    if (currentVideo === video) return;
    console.log('LCT: Video bulundu');
    currentVideo = video;

    // Native altyazıları kapat
    disableNativeTextTracks(video);

    // Track elementlerinden VTT URL bul
    const vttUrl = findVTTUrl(video);

    if (vttUrl) {
      await processVTT(vttUrl);
    } else {
      // Track henüz eklenmemiş olabilir, bekle
      waitForTracks(video);
    }

    // Video src değişikliğini izle (ders geçişleri)
    watchVideoChanges(video);
  }

  let nativeTrackHandlers = null;

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

  function waitForTracks(video) {
    let trackAttempts = 0;
    const trackObserver = new MutationObserver(() => {
      const url = findVTTUrl(video);
      if (url) {
        trackObserver.disconnect();
        processVTT(url);
      }
    });

    trackObserver.observe(video, { childList: true, subtree: true });

    // Yedek polling
    const interval = setInterval(() => {
      trackAttempts++;
      const url = findVTTUrl(video);
      if (url) {
        clearInterval(interval);
        trackObserver.disconnect();
        processVTT(url);
      }
      if (trackAttempts > 60) {
        clearInterval(interval);
        trackObserver.disconnect();
        console.log('LCT: Track bulunamadı');
        showMessage('Bu video için altyazı bulunamadı');
      }
    }, 1000);
  }

  // --- VTT İşleme Pipeline ---

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
        showMessage('API key gerekli — Eklenti ayarlarından girin');
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
      activeTranslationPort.disconnect();
      activeTranslationPort = null;
    }

    translationState = 'translating';
    showMessage('Çeviriliyor...');

    const epoch = translationEpoch;
    const videoId = extractVideoId();
    const port = chrome.runtime.connect({ name: 'translate' });
    activeTranslationPort = port;

    port.onMessage.addListener((msg) => {
      // Stale çeviri kontrolü — epoch değiştiyse sonucu at
      if (epoch !== translationEpoch) return;

      if (msg.type === 'PROGRESS') {
        if (msg.cached) {
          showMessage('Önbellekten yükleniyor...');
        } else {
          showMessage(`Çevriliyor... (${msg.current}/${msg.total})`);
        }
      } else if (msg.type === 'COMPLETE') {
        currentCues = msg.cues;
        translationState = 'done';
        activeTranslationPort = null;
        port.disconnect();
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
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      // Port beklenmedik şekilde kapandıysa ve hâlâ translating durumdaysa
      if (translationState === 'translating' && epoch === translationEpoch) {
        translationState = 'error';
        activeTranslationPort = null;
        showMessage('Bağlantı koptu');
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
    // URL'den Vimeo video ID'si
    const match = window.location.pathname.match(/\/video\/(\d+)/);
    if (match) return match[1];
    // Fallback: URL hash veya search params
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

  /**
   * Binary search ile aktif cue bulma
   * Kesin zaman eşleşmesi — tolerans yok
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
    renderer = createSubtitleRenderer(currentVideo, settings);
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
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          console.log('LCT: Video src değişti, yeniden başlatılıyor');
          cleanup();
          setTimeout(() => onVideoFound(video), 500);
          return;
        }
      }
    });

    videoObserver.observe(video, { attributes: true, attributeFilter: ['src'] });
  }

  function cleanup() {
    // Aktif çeviri port'unu kapat
    if (activeTranslationPort) {
      activeTranslationPort.disconnect();
      activeTranslationPort = null;
    }
    if (currentVideo) {
      enableNativeTextTracks(currentVideo);
      currentVideo.removeEventListener('timeupdate', onTimeUpdate);
      currentVideo = null;
    }
    syncListenerAttached = false;
    statusMessage = null;
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    currentCues = [];
    parsedOriginalCues = [];
    translationState = 'idle';
    lastVttUrl = null;
  }

  // --- Ayarlar & Mesajlar ---

  async function getSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response && response.success) return response.settings;
    } catch (e) {}
    // Fallback defaults
    return {
      enabled: true,
      showOriginal: true,
      showTranslation: true,
      fontSize: 25,
      originalColor: '#ffffff',
      translationColor: '#ffd700',
      bgOpacity: 0.75
    };
  }

  function listenForMessages() {
    // Birincil yöntem: chrome.storage.onChanged — iframe'lerde de çalışır
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
