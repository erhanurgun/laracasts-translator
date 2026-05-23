/**
 * Subtitle Renderer
 * Video üzerine çift altyazı overlay oluşturur ve günceller.
 *
 * API: createSubtitleRenderer(video, style, overrideContainer?) → {update, destroy, updateStyle}
 * overrideContainer: Shadow DOM senaryolarında overlay'in ekleneceği dış eleman (ör. mux-player)
 */

function createSubtitleRenderer(video, style, overrideContainer) {
  // Shadow DOM durumunda dış container, normal durumda video'nun parent'ı
  const container = overrideContainer || video.parentElement;
  if (!container) {
    console.error('LCT: Video parent bulunamadı');
    return null;
  }

  // Container'ı relative yap (overlay positioning için)
  const originalPosition = container.style.position;
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // Overlay elemanları oluştur
  const overlay = document.createElement('div');
  overlay.id = 'lct-subtitle-container';

  const originalEl = document.createElement('div');
  originalEl.id = 'lct-subtitle-original';

  const translationEl = document.createElement('div');
  translationEl.id = 'lct-subtitle-translation';

  overlay.appendChild(originalEl);
  overlay.appendChild(translationEl);
  container.appendChild(overlay);

  // Render hot-path no-op guard'ları: timeupdate Mux Player'da 4-66Hz
  // tetiklenir, aynı cue 2-5sn aktif kalır. Aynı metin/stil için DOM
  // yazımını atlamak reflow/repaint maliyetini düşürür. Bu state'ler
  // applyStyle'dan önce tanımlanmalı (TDZ).
  let lastOriginal = null;
  let lastTranslation = null;
  const appliedStyle = {};

  // İlk stil uygula
  applyStyle(style);

  // Fullscreen değişiklik listener
  function onFullscreenChange() {
    // CSS :fullscreen selector otomatik halleder ama overlay hâlâ DOM'da olmalı
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      // Fullscreen'de overlay hâlâ görünür olmalı
      overlay.style.bottom = '80px';
    } else {
      overlay.style.bottom = '60px';
    }
  }

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  function applyStyle(s) {
    if (!s) return;

    if (s.fontSize !== undefined && s.fontSize !== appliedStyle.fontSize) {
      originalEl.style.fontSize = `${s.fontSize}px`;
      translationEl.style.fontSize = `${s.fontSize + 2}px`;
      appliedStyle.fontSize = s.fontSize;
    }

    if (s.originalColor !== undefined && s.originalColor !== appliedStyle.originalColor) {
      originalEl.style.color = s.originalColor;
      appliedStyle.originalColor = s.originalColor;
    }

    if (s.translationColor !== undefined && s.translationColor !== appliedStyle.translationColor) {
      translationEl.style.color = s.translationColor;
      appliedStyle.translationColor = s.translationColor;
    }

    if (s.bgOpacity !== undefined && s.bgOpacity !== appliedStyle.bgOpacity) {
      const bg = `rgba(0, 0, 0, ${s.bgOpacity})`;
      originalEl.style.background = bg;
      translationEl.style.background = bg;
      appliedStyle.bgOpacity = s.bgOpacity;
    }

    if (s.showOriginal !== undefined && s.showOriginal !== appliedStyle.showOriginal) {
      originalEl.style.display = s.showOriginal ? '' : 'none';
      appliedStyle.showOriginal = s.showOriginal;
    }

    if (s.showTranslation !== undefined && s.showTranslation !== appliedStyle.showTranslation) {
      translationEl.style.display = s.showTranslation ? '' : 'none';
      appliedStyle.showTranslation = s.showTranslation;
    }

    // Orijinal (kaynak dil) metni bulanıklaştırma: öğrenme modu.
    // Kullanıcı önce kendi tahmin eder, hover ile netleştirebilir.
    // Çeviri hep net kalır - nihai anlama yolu.
    if (s.blurOriginal !== undefined && s.blurOriginal !== appliedStyle.blurOriginal) {
      originalEl.classList.toggle('lct-blur', !!s.blurOriginal);
      appliedStyle.blurOriginal = s.blurOriginal;
    }
  }

  // --- Public API ---

  return {
    update(originalText, translationText) {
      const oNew = originalText || '';
      const tNew = translationText || '';
      // Hot path: timeupdate'te aynı cue tekrar geldiğinde DOM write atlanır
      if (oNew !== lastOriginal) {
        originalEl.textContent = oNew;
        lastOriginal = oNew;
      }
      if (tNew !== lastTranslation) {
        translationEl.textContent = tNew;
        lastTranslation = tNew;
      }
    },

    updateStyle(newStyle) {
      applyStyle(newStyle);
    },

    destroy() {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      overlay.remove();
      if (originalPosition !== undefined) {
        container.style.position = originalPosition;
      }
    }
  };
}

if (typeof self !== 'undefined') {
  self.createSubtitleRenderer = createSubtitleRenderer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSubtitleRenderer };
}
