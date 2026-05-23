/**
 * Visibility-aware setInterval wrapper.
 * Tab/sekme gizli (document.visibilityState === 'hidden') olduğunda
 * polling otomatik durdurulur, visible olunca devam eder. Bu sayede
 * arka plan sekmelerde CPU yakılması sıfırlanır.
 *
 * Aynı zamanda lifecycle merkezi: createPoll()/stop() birbirine bağlı,
 * cleanup'ta tüm visibility listener'ları sökülür.
 *
 * Kullanım:
 *   const poll = createPoll(() => check(), 500);
 *   // sonra
 *   poll.stop();
 *
 * Chrome Extension: global `self.createPoll`.
 * Node (test): `require('lib/poll-helper.js').createPoll`.
 */
function createPoll(fn, intervalMs, options) {
  if (typeof fn !== 'function') {
    throw new TypeError('fn callback gerekli');
  }
  if (typeof intervalMs !== 'number' || intervalMs <= 0) {
    throw new TypeError('intervalMs pozitif sayı olmalı');
  }
  const opts = options || {};
  const runWhenHidden = !!opts.runWhenHidden;
  const startImmediately = opts.startImmediately !== false;

  let intervalId = null;
  let stopped = false;
  let visibilityHandler = null;

  function isHidden() {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  function start() {
    if (stopped || intervalId) return;
    if (!runWhenHidden && isHidden()) return;
    intervalId = setInterval(() => {
      try { fn(); } catch (e) {
        console.warn('LCT-Poll: callback hatası:', e && e.message);
      }
    }, intervalMs);
  }

  function pause() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function stop() {
    stopped = true;
    pause();
    if (visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  }

  if (!runWhenHidden && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    visibilityHandler = () => {
      if (stopped) return;
      if (isHidden()) {
        pause();
      } else if (!intervalId) {
        start();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  if (startImmediately) start();

  return {
    stop,
    isRunning() { return intervalId !== null; },
    isStopped() { return stopped; },
    // Manuel kontrol için (örn. dış koşul değişimi)
    forceStart() { start(); },
    forcePause() { pause(); }
  };
}

if (typeof self !== 'undefined') {
  self.createPoll = createPoll;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createPoll };
}
