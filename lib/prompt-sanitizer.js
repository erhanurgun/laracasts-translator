/**
 * OpenAI prompt'a gönderilen caption'ları güvenli hale getirir.
 * Amaç: caption içeriği saldırgan kontrolünde ise system prompt'u ezmeye
 * veya model davranışını manipüle etmeye yönelik enjeksiyonları etkisizleştirmek.
 *
 * Sanitization adımları:
 * 1) Kontrol karakterlerini strip (newline ve tab hariç).
 * 2) Newline'ları boşluğa çevir (numaralı satır parse'ını bozmaması için).
 * 3) System/role/assistant anahtar kelimelerini no-op forma getir.
 * 4) Template literal ve markdown bozma karakterlerini escape et.
 * 5) Uzunluğu sınırla (varsayılan 500).
 *
 * Davranış: normal İngilizce caption'ı bozmayacak kadar konservatif tutuldu.
 */
const LCTPromptSanitizer = (() => {
  const DEFAULT_MAX_LEN = 500;

  const INJECTION_PATTERNS = [
    /\b(?:ignore|disregard|forget)\s+(?:previous|prior|all|above)\s+(?:instructions?|prompts?|rules?)/gi,
    /\byou\s+are\s+(?:now|a|an)\s+/gi,
    /\bsystem\s*:\s*/gi,
    /\bassistant\s*:\s*/gi,
    /\buser\s*:\s*/gi,
    /\bprint\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?)/gi,
    /\breveal\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?)/gi,
    /<\/?\s*\|?\s*(?:im_start|im_end|endoftext|system|user|assistant)\s*\|?\s*>/gi
  ];

  function stripControlChars(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      // Tab (0x09), newline (0x0A) ve printable (>=0x20, <0x7F veya >=0xA0) geçer
      if (code === 0x09 || code === 0x0A || code === 0x0D) {
        out += s[i];
      } else if (code >= 0x20 && code !== 0x7F) {
        out += s[i];
      }
    }
    return out;
  }

  function neutralizeInjectionPatterns(s) {
    let out = s;
    for (const re of INJECTION_PATTERNS) {
      out = out.replace(re, (m) => `[neutralized:${m.length}]`);
    }
    return out;
  }

  // Replacement karakterleri unicode escape ile (source code parse sorunsuz)
  const MODIFIER_GRAVE = 'ˋ';
  const ZWSP = '​';

  function escapeTemplateChars(s) {
    // Backtick ve ${} enjeksiyonunu etkisizleştir
    return s
      .replace(/`/g, MODIFIER_GRAVE)
      .replace(/\$\{/g, '$' + ZWSP + '{');
  }

  /**
   * @param {string} text
   * @param {number} [maxLen]
   * @returns {string}
   */
  function sanitizeCaption(text, maxLen = DEFAULT_MAX_LEN) {
    if (typeof text !== 'string') return '';
    let s = text;
    s = stripControlChars(s);
    s = s.replace(/[\r\n]+/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = neutralizeInjectionPatterns(s);
    s = escapeTemplateChars(s);
    if (s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  /**
   * @param {string[]} texts
   * @param {number} [maxLen]
   * @returns {string[]}
   */
  function sanitizeBatch(texts, maxLen = DEFAULT_MAX_LEN) {
    if (!Array.isArray(texts)) return [];
    return texts.map(t => sanitizeCaption(t, maxLen));
  }

  return Object.freeze({
    DEFAULT_MAX_LEN,
    INJECTION_PATTERNS,
    sanitizeCaption,
    sanitizeBatch
  });
})();

if (typeof self !== 'undefined') {
  self.LCTPromptSanitizer = LCTPromptSanitizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTPromptSanitizer };
}
