/**
 * Laracasts Inertia transcriptSegments (paragraf bazlı) için cümle bölücü.
 * Paragraf cue'sunu cümle sınırlarından (noktalama + boşluk + büyük harf) böler,
 * her cümleye karakter oranına göre zaman aralığı dağıtır.
 *
 * Kısa parçalar (< 10 karakter) bir önceki cümleyle birleştirilir.
 * Tek cümle kaldığında veya zamanlama eksikse segment olduğu gibi döner.
 */
const LCTSentenceSplitter = (() => {
  const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z])/;
  const MIN_CHARS = 10;

  /**
   * @param {{id?: string, startTime: number, endTime: number, text: string}} segment
   * @returns {Array<{id: string, startTime: number, endTime: number, text: string}>}
   */
  function split(segment) {
    if (!segment || typeof segment.text !== 'string') return [segment].filter(Boolean);

    const { startTime, endTime, text, id } = segment;
    if (typeof startTime !== 'number' || typeof endTime !== 'number') {
      return [segment];
    }

    const sentences = text.split(SENTENCE_BREAK).filter(s => s.trim().length > 0);
    if (sentences.length <= 1) return [segment];

    // Kısa parçaları önceki cümleyle birleştir
    const merged = [sentences[0]];
    for (let i = 1; i < sentences.length; i++) {
      if (sentences[i].length < MIN_CHARS) {
        merged[merged.length - 1] += ' ' + sentences[i];
      } else {
        merged.push(sentences[i]);
      }
    }
    if (merged.length <= 1) return [segment];

    const totalChars = merged.reduce((sum, s) => sum + s.length, 0);
    const duration = endTime - startTime;
    let currentStart = startTime;

    return merged.map((sentence, i) => {
      const ratio = sentence.length / totalChars;
      const sentenceDuration = duration * ratio;
      const sentenceStart = currentStart;
      const sentenceEnd = (i === merged.length - 1) ? endTime : currentStart + sentenceDuration;
      currentStart = sentenceEnd;

      return {
        id: `${id || ''}_${i + 1}`,
        startTime: Math.round(sentenceStart * 1000) / 1000,
        endTime: Math.round(sentenceEnd * 1000) / 1000,
        text: sentence.trim()
      };
    });
  }

  return Object.freeze({ MIN_CHARS, split });
})();

if (typeof self !== 'undefined') {
  self.LCTSentenceSplitter = LCTSentenceSplitter;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTSentenceSplitter };
}
