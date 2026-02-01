/**
 * Content Script - Laracasts.com ana sayfasında çalışır
 * - Ders meta bilgisi çıkarma
 * - Çeviri durum göstergesi
 * - SPA navigasyon tespiti
 */

(function () {
  'use strict';

  if (window.__lctLaracastsLoaded) return;
  window.__lctLaracastsLoaded = true;

  let indicator = null;

  function init() {
    if (!isLessonPage()) return;
    createIndicator();
    listenForMessages();
    watchNavigation();
  }

  function isLessonPage() {
    // /series/xxx/episodes/yyy veya /topics/xxx/episodes/yyy gibi
    return /\/(series|topics|bits|paths)\//.test(window.location.pathname);
  }

  // --- Durum Göstergesi ---

  function createIndicator() {
    if (indicator) indicator.remove();

    indicator = document.createElement('div');
    indicator.id = 'lct-status-indicator';
    Object.assign(indicator.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      padding: '6px 12px',
      background: 'rgba(79, 70, 229, 0.9)',
      color: '#fff',
      fontSize: '12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      borderRadius: '6px',
      zIndex: '10000',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.3s ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
    });

    document.body.appendChild(indicator);
  }

  function showStatus(text, duration) {
    if (!indicator) createIndicator();
    indicator.textContent = text;
    indicator.style.opacity = '1';

    if (duration) {
      setTimeout(() => {
        if (indicator) indicator.style.opacity = '0';
      }, duration);
    }
  }

  // --- Ders Meta Bilgisi ---

  function getLessonMeta() {
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const series = document.querySelector('[class*="series-title"], .breadcrumb a')?.textContent?.trim() || '';
    return { title, series };
  }

  // --- SPA Navigasyon Tespiti ---

  function watchNavigation() {
    let lastUrl = location.href;

    // Livewire/Turbo navigasyon izleme
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onNavigate();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // popstate/pushstate desteği
    window.addEventListener('popstate', onNavigate);

    const origPushState = history.pushState;
    history.pushState = function () {
      origPushState.apply(this, arguments);
      onNavigate();
    };
  }

  function onNavigate() {
    if (isLessonPage()) {
      createIndicator();
    } else {
      if (indicator) {
        indicator.remove();
        indicator = null;
      }
    }
  }

  // --- Mesaj Dinleyicisi ---

  function listenForMessages() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TRANSLATION_STATUS') {
        if (message.status === 'translating') {
          showStatus('Çeviriliyor...', 0);
        } else if (message.status === 'done') {
          showStatus('Çeviri hazır', 3000);
        } else if (message.status === 'error') {
          showStatus(`Hata: ${message.error}`, 5000);
        } else if (message.status === 'cached') {
          showStatus('Önbellekten yüklendi', 2000);
        }
      }
    });
  }

  init();
})();
