/**
 * Laracasts Inertia [data-page] içindeki transcriptSegments'i okur.
 * Inertia prop ağacı değişken derinlikte; findDeep ile iç içe aranır.
 * Pure; sayfa-fetch bağımlılığı dışarı bırakıldı (inject ederek test edilebilir).
 */
const LCTTranscriptReader = (() => {
  /**
   * Obje ağacında anahtar özyinelemeli arar.
   */
  function findDeep(obj, key) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[key]) return obj[key];
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') {
        const found = findDeep(v, key);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * data-page JSON string'inden transcriptSegments dizisini çıkartır.
   * Stale kontrolü için currentPathname verilmişse pageData.url ile karşılaştırır.
   *
   * @param {string} dataPageJson
   * @param {string} [currentPathname]
   * @returns {{ segments: Array|null, stale: boolean }}
   */
  function parseDataPage(dataPageJson, currentPathname) {
    try {
      const pageData = JSON.parse(dataPageJson);
      if (currentPathname && pageData.url && pageData.url !== currentPathname) {
        return { segments: null, stale: true };
      }
      const segments = findDeep(pageData.props, 'transcriptSegments');
      if (!Array.isArray(segments) || segments.length === 0) {
        return { segments: null, stale: false };
      }
      return { segments, stale: false };
    } catch (_) {
      return { segments: null, stale: false };
    }
  }

  /**
   * transcriptSegments ham dizisini {id, startTime, endTime, text} cue formatına çevirir.
   * HTML tag'lerini strip eder.
   */
  function mapSegments(rawSegments) {
    if (!Array.isArray(rawSegments)) return [];
    return rawSegments
      .filter(s => s && typeof s.text === 'string')
      .map((seg, i) => ({
        id: String(seg.id || i + 1),
        startTime: seg.startTime,
        endTime: seg.endTime,
        text: seg.text.replace(/<[^>]*>/g, '')
      }));
  }

  return Object.freeze({
    findDeep,
    parseDataPage,
    mapSegments
  });
})();

if (typeof self !== 'undefined') {
  self.LCTTranscriptReader = LCTTranscriptReader;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTTranscriptReader };
}
