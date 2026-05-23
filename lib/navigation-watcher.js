/**
 * SPA navigasyon dinleyicisi.
 * Inertia.js gibi tek sayfa uygulamaların pushState/replaceState çağrıları,
 * tarayıcının Navigation API'si ve popstate event'i üzerinden URL değişimini
 * algılar. document.body subtree:true MutationObserver alternatifidir;
 * Mux Player progress bar gibi sık DOM mutation üreten elementler tarafından
 * spam'lenmez.
 *
 * Kullanım:
 *   const watcher = createNavigationWatcher((newUrl) => { ... });
 *   // sonra: watcher.destroy();
 *
 * Chrome Extension: global `self.createNavigationWatcher`.
 * Node (test): `require('lib/navigation-watcher.js').createNavigationWatcher`.
 */
function createNavigationWatcher(onNavigate, options) {
  if (typeof onNavigate !== 'function') {
    throw new TypeError('onNavigate callback gerekli');
  }
  const opts = options || {};
  const popstateDelayMs = typeof opts.popstateDelayMs === 'number' ? opts.popstateDelayMs : 50;
  const pushDelayMs = typeof opts.pushDelayMs === 'number' ? opts.pushDelayMs : 0;

  let lastUrl = (typeof location !== 'undefined' && location.href) || '';
  const cleanupFns = [];
  let destroyed = false;

  function fire() {
    if (destroyed || typeof location === 'undefined') return;
    const newUrl = location.href;
    if (newUrl === lastUrl) return;
    lastUrl = newUrl;
    try { onNavigate(newUrl); } catch (e) {
      console.warn('LCT-NavWatcher: onNavigate hatası:', e && e.message);
    }
  }

  function scheduleFire(delay) {
    if (delay > 0) {
      setTimeout(fire, delay);
    } else {
      // 0 delay: senkron fire (ardışık pushState'lerin coalesce olmaması için).
      fire();
    }
  }

  // 1) Navigation API (Chromium 102+)
  if (typeof window !== 'undefined' && window.navigation && typeof window.navigation.addEventListener === 'function') {
    const navHandler = () => scheduleFire(pushDelayMs);
    try {
      window.navigation.addEventListener('navigate', navHandler);
      cleanupFns.push(() => window.navigation.removeEventListener('navigate', navHandler));
    } catch (_) { /* eski Chromium */ }
  }

  // 2) history.pushState/replaceState patch - URL commit'i sonrası senkron fire.
  if (typeof history !== 'undefined') {
    const origPush = history.pushState;
    if (typeof origPush === 'function') {
      history.pushState = function () {
        const r = origPush.apply(this, arguments);
        fire();
        return r;
      };
      cleanupFns.push(() => { history.pushState = origPush; });
    }

    const origReplace = history.replaceState;
    if (typeof origReplace === 'function') {
      history.replaceState = function () {
        const r = origReplace.apply(this, arguments);
        fire();
        return r;
      };
      cleanupFns.push(() => { history.replaceState = origReplace; });
    }
  }

  // 3) popstate (browser back/forward) - URL commit'i kontrol önemsiz olduğundan
  // küçük gecikme bekleyip fire (race koruması).
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const popHandler = () => scheduleFire(popstateDelayMs);
    window.addEventListener('popstate', popHandler);
    cleanupFns.push(() => window.removeEventListener('popstate', popHandler));
  }

  return {
    destroy() {
      destroyed = true;
      while (cleanupFns.length) {
        try { cleanupFns.pop()(); } catch (_) {}
      }
    },
    // Test ve introspection için
    getLastUrl() { return lastUrl; }
  };
}

if (typeof self !== 'undefined') {
  self.createNavigationWatcher = createNavigationWatcher;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createNavigationWatcher };
}
