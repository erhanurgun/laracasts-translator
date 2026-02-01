/**
 * Subtitle Renderer
 * Video üzerine çift altyazı overlay oluşturur ve günceller.
 *
 * API: createSubtitleRenderer(video, style) → {update, destroy, updateStyle}
 */

function createSubtitleRenderer(video, style) {
  // Video'nun parent'ını bul (position: relative olan container)
  const container = video.parentElement;
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

    if (s.fontSize) {
      originalEl.style.fontSize = `${s.fontSize}px`;
      translationEl.style.fontSize = `${s.fontSize + 2}px`;
    }

    if (s.originalColor) {
      originalEl.style.color = s.originalColor;
    }

    if (s.translationColor) {
      translationEl.style.color = s.translationColor;
    }

    if (s.bgOpacity !== undefined) {
      const bg = `rgba(0, 0, 0, ${s.bgOpacity})`;
      originalEl.style.background = bg;
      translationEl.style.background = bg;
    }

    if (s.showOriginal !== undefined) {
      originalEl.style.display = s.showOriginal ? '' : 'none';
    }

    if (s.showTranslation !== undefined) {
      translationEl.style.display = s.showTranslation ? '' : 'none';
    }
  }

  // --- Public API ---

  return {
    update(originalText, translationText) {
      originalEl.textContent = originalText || '';
      translationEl.textContent = translationText || '';
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
