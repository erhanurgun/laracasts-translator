/**
 * Uzun cue'ları doğal break noktalarından bölen recursive splitter.
 * - Virgül veya bağlaçtan (and/or/but/so/that/which/where/when/because/if/while/after/before/since)
 *   orta noktaya en yakın konumdan böler.
 * - Break bulunamazsa orta noktaya en yakın boşluktan böler.
 * - Zaman dağılımı karakter oranıyla yapılır.
 */
const LCTCueSplitter = (() => {
  const DEFAULT_MAX_LEN = 70;
  const BREAK_PATTERN = /,\s|\s(?:and|or|but|so|that|which|where|when|because|if|while|after|before|since)\s/gi;

  function findBestBreakPosition(text, mid) {
    let bestPos = -1;
    let bestDist = Infinity;

    for (const match of text.matchAll(BREAK_PATTERN)) {
      const pos = match.index + match[0].indexOf(' ');
      const dist = Math.abs(pos - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = pos;
      }
    }

    if (bestPos !== -1) return bestPos;

    // Fallback: orta noktaya en yakın boşluk
    for (let offset = 0; offset < mid; offset++) {
      if (text[mid + offset] === ' ') return mid + offset;
      if (text[mid - offset] === ' ') return mid - offset;
    }
    return -1;
  }

  /**
   * @param {{id?: string, startTime: number, endTime: number, text: string}} cue
   * @param {number} [maxLen]
   * @returns {Array<{id: string, startTime: number, endTime: number, text: string}>}
   */
  function split(cue, maxLen = DEFAULT_MAX_LEN) {
    if (!cue || typeof cue.text !== 'string') return [cue].filter(Boolean);
    if (cue.text.length <= maxLen) return [cue];

    const text = cue.text;
    const mid = Math.floor(text.length / 2);
    const bestPos = findBestBreakPosition(text, mid);

    if (bestPos <= 0 || bestPos >= text.length - 1) return [cue];

    const part1Text = text.slice(0, bestPos).trim();
    const part2Text = text.slice(bestPos).trim();
    if (!part1Text || !part2Text) return [cue];

    const totalChars = part1Text.length + part2Text.length;
    const duration = cue.endTime - cue.startTime;
    const splitTime = cue.startTime + duration * (part1Text.length / totalChars);

    const part1 = {
      id: (cue.id || '') + '_a',
      startTime: Math.round(cue.startTime * 1000) / 1000,
      endTime: Math.round(splitTime * 1000) / 1000,
      text: part1Text
    };
    const part2 = {
      id: (cue.id || '') + '_b',
      startTime: Math.round(splitTime * 1000) / 1000,
      endTime: Math.round(cue.endTime * 1000) / 1000,
      text: part2Text
    };

    return [...split(part1, maxLen), ...split(part2, maxLen)];
  }

  return Object.freeze({
    DEFAULT_MAX_LEN,
    split
  });
})();

if (typeof self !== 'undefined') {
  self.LCTCueSplitter = LCTCueSplitter;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTCueSplitter };
}
