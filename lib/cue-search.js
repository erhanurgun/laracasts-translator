/**
 * Cue dizilerinde aktif cue bulma (binary search).
 * Zaman tolerance'ı yok — exact time inclusion ([startTime, endTime]).
 * Performans: O(log n), sık timeupdate çağrıları için kritik.
 */
const LCTCueSearch = Object.freeze({
  /**
   * @param {Array<{startTime: number, endTime: number}>} cues
   * @param {number} time
   * @returns {object|null}
   */
  findActive(cues, time) {
    if (!Array.isArray(cues) || cues.length === 0) return null;
    if (typeof time !== 'number' || Number.isNaN(time)) return null;

    let low = 0;
    let high = cues.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const cue = cues[mid];
      if (time < cue.startTime) {
        high = mid - 1;
      } else if (time > cue.endTime) {
        low = mid + 1;
      } else {
        return cue;
      }
    }
    return null;
  }
});

if (typeof self !== 'undefined') {
  self.LCTCueSearch = LCTCueSearch;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTCueSearch };
}
