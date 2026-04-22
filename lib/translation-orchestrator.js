/**
 * Translation orchestration: background port bağlantısı + epoch/stale flag +
 * otomatik retry + callback dispatch.
 *
 * Race condition koruması: port.disconnect sonrası late gelen mesajlar
 * isStale flag'i ile filtrelenir; epoch numarası ile farklı çeviri
 * oturumlarının karıştırılması önlenir.
 */
const LCTTranslationOrchestrator = (() => {
  /**
   * @param {object} options
   * @param {(progress: object) => void} options.onProgress
   * @param {(data: {startIndex: number, cues: Array}) => void} options.onBatchResult
   * @param {(cues: Array) => void} options.onComplete
   * @param {(error: string) => void} options.onError
   * @param {() => void} [options.onRetry] - yeniden bağlantı denenirken çağrılır (kullanıcıya haber vermek için)
   * @param {() => void} [options.onAbandon] - max retry tükendiğinde
   * @param {number} [options.maxRetries=2]
   * @param {{connect: Function}} [options.runtime] - chrome.runtime; test için enjekte edilir
   * @returns {{start, cancel, isActive}}
   */
  function create(options) {
    const {
      onProgress = () => {},
      onBatchResult = () => {},
      onComplete = () => {},
      onError = () => {},
      onRetry = () => {},
      onAbandon = () => {},
      maxRetries = 2,
      runtime
    } = options || {};

    let port = null;
    let epoch = 0;
    let retryCount = 0;
    let isStale = false;
    let lastPayload = null;

    const chromeRuntime = runtime
      || (typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime : null);

    function hardReset() {
      isStale = true;
      if (port) {
        try { port.disconnect(); } catch (_) {}
      }
      port = null;
    }

    function start(cues, videoId) {
      if (!chromeRuntime || typeof chromeRuntime.connect !== 'function') {
        onError('Runtime bağlantısı kullanılamıyor');
        return;
      }

      // Önceki oturumu sonlandır
      hardReset();
      isStale = false;
      epoch++;
      retryCount = 0;
      lastPayload = { cues, videoId };

      _openPort();
    }

    function _openPort() {
      const currentEpoch = epoch;
      port = chromeRuntime.connect({ name: 'translate' });

      port.onMessage.addListener((msg) => {
        if (isStale || epoch !== currentEpoch || !msg) return;

        if (msg.type === 'PROGRESS') {
          onProgress(msg);
        } else if (msg.type === 'BATCH_RESULT') {
          onBatchResult({ startIndex: msg.startIndex, cues: msg.cues });
        } else if (msg.type === 'COMPLETE') {
          isStale = true;
          try { port.disconnect(); } catch (_) {}
          port = null;
          onComplete(msg.cues);
        } else if (msg.type === 'ERROR') {
          isStale = true;
          try { port.disconnect(); } catch (_) {}
          port = null;
          onError(msg.error || 'Çeviri hatası');
        }
      });

      port.onDisconnect.addListener(() => {
        if (isStale || epoch !== currentEpoch) return;

        if (retryCount < maxRetries && lastPayload) {
          retryCount++;
          onRetry({ retryCount, maxRetries });
          setTimeout(() => {
            if (!isStale && epoch === currentEpoch) _openPort();
          }, 2000);
        } else {
          isStale = true;
          onAbandon({ retryCount, maxRetries });
        }
      });

      port.postMessage({ type: 'TRANSLATE_CUES', cues: lastPayload.cues, videoId: lastPayload.videoId });
    }

    function cancel() {
      hardReset();
      lastPayload = null;
    }

    function isActive() {
      return !isStale && port !== null;
    }

    return Object.freeze({ start, cancel, isActive });
  }

  return Object.freeze({ create });
})();

if (typeof self !== 'undefined') {
  self.LCTTranslationOrchestrator = LCTTranslationOrchestrator;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTTranslationOrchestrator };
}
