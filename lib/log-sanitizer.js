/**
 * Log mesajlarındaki kişisel veri sızıntısını engeller.
 * - URL query param'ları maskelenir (timedtext URL'inde videoId/tokenlar)
 * - videoId ilk 4 karakter + "..." olarak maskelenir
 * - API key vb. token'lar query'den çıkarılır
 */
const LCTLogSanitizer = (() => {
  const VIDEO_ID_PREFIX_LEN = 4;

  function sanitizeUrl(url) {
    if (typeof url !== 'string' || url.length === 0) return '';
    try {
      const u = new URL(url);
      // Query parametrelerini maskele
      return `${u.origin}${u.pathname}?[redacted]`;
    } catch (_) {
      return '[invalid-url]';
    }
  }

  function sanitizeVideoId(videoId) {
    if (typeof videoId !== 'string' || videoId.length === 0) return '[no-id]';
    if (videoId.length <= VIDEO_ID_PREFIX_LEN) return `${videoId}...`;
    return `${videoId.slice(0, VIDEO_ID_PREFIX_LEN)}...`;
  }

  function sanitizeApiKey(key) {
    if (typeof key !== 'string' || key.length === 0) return '[none]';
    if (key.length <= 8) return '[short]';
    return `${key.slice(0, 3)}...${key.slice(-3)}`;
  }

  /**
   * Generic PII temizleyici: yaygın sensitive token'ları maskeler.
   * @param {string} text
   */
  function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text
      // Bearer / API key tarzı
      .replace(/\bsk-[A-Za-z0-9]{10,}/g, '[api-key]')
      .replace(/\bBearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
      // Email benzeri
      .replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)/g, '$1***@$2');
  }

  return Object.freeze({
    VIDEO_ID_PREFIX_LEN,
    sanitizeUrl,
    sanitizeVideoId,
    sanitizeApiKey,
    sanitizeText
  });
})();

if (typeof self !== 'undefined') {
  self.LCTLogSanitizer = LCTLogSanitizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTLogSanitizer };
}
