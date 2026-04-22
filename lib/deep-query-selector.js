/**
 * İç içe shadow DOM'larda BFS ile element arar (maks 5 seviye).
 * Mux Player gibi çok katmanlı web component'ler için gerekli.
 * Pure function — sadece DOM traversal.
 */
const LCTDeepQuery = Object.freeze({
  DEFAULT_MAX_DEPTH: 5,

  /**
   * @param {Element} host
   * @param {string} selector
   * @param {number} [maxDepth=5]
   * @returns {Element|null}
   */
  find(host, selector, maxDepth = 5) {
    if (!host || typeof host.shadowRoot === 'undefined') return null;

    const roots = [];
    if (host.shadowRoot) roots.push(host.shadowRoot);

    for (let depth = 0; depth < maxDepth && roots.length > 0; depth++) {
      const nextRoots = [];
      for (const root of roots) {
        const found = root.querySelector(selector);
        if (found) return found;

        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) nextRoots.push(el.shadowRoot);
        }
      }
      roots.length = 0;
      roots.push(...nextRoots);
    }
    return null;
  }
});

if (typeof self !== 'undefined') {
  self.LCTDeepQuery = LCTDeepQuery;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTDeepQuery };
}
