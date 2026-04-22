/**
 * Laracasts için postMessage + chrome.runtime mesaj doğrulama helper'ı.
 * Yalnızca laracasts.com (ve www.laracasts.com) origin'i güvenilir kabul edilir.
 */
const LCTOriginGuard = (() => {
  const TRUSTED_ORIGINS = Object.freeze([
    'https://laracasts.com',
    'https://www.laracasts.com'
  ]);

  const LARACASTS_URL_REGEX = /^https:\/\/(www\.)?laracasts\.com\//;

  function isTrustedLaracastsOrigin(origin) {
    if (typeof origin !== 'string') return false;
    return TRUSTED_ORIGINS.includes(origin);
  }

  function isTrustedLaracastsUrl(url) {
    if (typeof url !== 'string') return false;
    return LARACASTS_URL_REGEX.test(url);
  }

  /**
   * @param {MessageEvent} event
   * @param {string[]} allowedTypes
   */
  function isValidPageMessage(event, allowedTypes) {
    if (!event || typeof event !== 'object') return false;
    if (typeof event.origin !== 'string') return false;
    if (event.origin !== '' && !isTrustedLaracastsOrigin(event.origin)) return false;

    const data = event.data;
    if (!data || typeof data !== 'object') return false;
    if (typeof data.type !== 'string') return false;
    if (Array.isArray(allowedTypes) && allowedTypes.length > 0 && !allowedTypes.includes(data.type)) {
      return false;
    }
    return true;
  }

  function isValidRuntimeSender(sender) {
    if (!sender) return false;
    if (sender.id && typeof sender.id === 'string') {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        return sender.id === chrome.runtime.id;
      }
      return true;
    }
    if (sender.url && isTrustedLaracastsUrl(sender.url)) return true;
    return false;
  }

  return Object.freeze({
    TRUSTED_ORIGINS,
    LARACASTS_URL_REGEX,
    isTrustedLaracastsOrigin,
    isTrustedLaracastsUrl,
    isValidPageMessage,
    isValidRuntimeSender
  });
})();

if (typeof self !== 'undefined') {
  self.LCTOriginGuard = LCTOriginGuard;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTOriginGuard };
}
