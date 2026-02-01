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

  function disableNativeTextTracks(video) {
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = 'disabled';
    }
    // Yeni track eklenirse de kapat
    video.textTracks.addEventListener('addtrack', () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
    });
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

      // Video ID'yi URL'den çıkar
      const videoId = extractVideoId();

      // Renderer oluştur
      ensureRenderer();

      // Sadece orijinal ile başlat
      currentCues = cues.map(c => ({ ...c, translation: '' }));
      startSync();

      // Çeviri iste
      showMessage('Çeviriliyor...');
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_CUES',
        cues: cues,
        videoId: videoId
      });

      if (response && response.success) {
        currentCues = response.cues;
        showMessage('');
        console.log('LCT: Çeviri tamamlandı');
      } else {
        const errorMsg = response ? response.error : 'Bağlantı hatası';
        console.warn('LCT: Çeviri hatası:', errorMsg);
        showMessage(errorMsg);
        // Orijinal altyazılarla devam et (graceful degradation)
      }

    } catch (err) {
      console.error('LCT: Pipeline hatası:', err);
      showMessage('Bir hata oluştu');
    }
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

    currentVideo.addEventListener('timeupdate', onTimeUpdate);
  }

  function onTimeUpdate() {
    if (!currentVideo || !renderer || !isEnabled) return;

    const time = currentVideo.currentTime;
    const activeCue = findActiveCue(time);

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
    if (!renderer && currentVideo) ensureRenderer();
    if (renderer) {
      if (msg) {
        renderer.update('', msg);
      }
    }
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
    if (currentVideo) {
      currentVideo.removeEventListener('timeupdate', onTimeUpdate);
    }
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
    currentCues = [];
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
      fontSize: 16,
      originalColor: '#ffffff',
      translationColor: '#ffd700',
      bgOpacity: 0.75
    };
  }

  function listenForMessages() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SETTINGS_CHANGED') {
        onSettingsChanged();
      }
    });
  }

  async function onSettingsChanged() {
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
  }

  // --- Başlat ---
  init();
})();
