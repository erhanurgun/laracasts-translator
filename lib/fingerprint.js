/**
 * Çeviri cache doğrulaması için fingerprint üretir.
 * Laracasts fingerprint versiyonu v2 (mevcut sürümle birebir uyumlu).
 */
const LCTFingerprint = Object.freeze({
  VERSION: 'v2',

  /**
   * @param {Array<{text?: string}>} cues
   * @returns {string}
   */
  create(cues) {
    if (!Array.isArray(cues)) {
      throw new TypeError('cues bir dizi olmalı');
    }
    const allText = cues
      .map(c => (c && typeof c.text === 'string') ? c.text : '')
      .join('|');
    let hash = 0;
    for (let i = 0; i < allText.length; i++) {
      hash = ((hash << 5) - hash + allText.charCodeAt(i)) | 0;
    }
    return `${this.VERSION}:${cues.length}:${hash}`;
  }
});

if (typeof self !== 'undefined') {
  self.LCTFingerprint = LCTFingerprint;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTFingerprint };
}
