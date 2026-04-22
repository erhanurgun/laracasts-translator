/**
 * Çeviri için cue'ları batch'lere böler.
 * Sıralamayı korur. BATCH_SIZE varsayılan YTTConstants.BATCH_SIZE (50).
 */
const LCTBatchBuilder = Object.freeze({
  DEFAULT_BATCH_SIZE: 50,

  /**
   * @param {Array} items
   * @param {number} [batchSize]
   * @returns {Array<{startIndex: number, items: Array}>}
   */
  build(items, batchSize) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const size = (typeof batchSize === 'number' && batchSize > 0)
      ? Math.floor(batchSize)
      : this.DEFAULT_BATCH_SIZE;
    const batches = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push({
        startIndex: i,
        items: items.slice(i, i + size)
      });
    }
    return batches;
  }
});

if (typeof self !== 'undefined') {
  self.LCTBatchBuilder = LCTBatchBuilder;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTBatchBuilder };
}
