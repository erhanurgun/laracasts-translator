/**
 * WebVTT Parser
 * Input: raw VTT text
 * Output: [{id, startTime, endTime, text}]
 * startTime/endTime saniye cinsinden (float)
 */
const VTTParser = {
  parse(vttText) {
    const cues = [];
    // Normalize line endings
    const text = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Blokları çift newline ile ayır
    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;

      // WEBVTT header, NOTE, STYLE bloklarını atla
      if (lines[0].startsWith('WEBVTT') ||
          lines[0].startsWith('NOTE') ||
          lines[0].startsWith('STYLE')) {
        continue;
      }

      // Timestamp satırını bul
      let timestampLineIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          timestampLineIdx = i;
          break;
        }
      }

      if (timestampLineIdx === -1) continue;

      // Opsiyonel cue ID (timestamp'tan önceki satır)
      const id = timestampLineIdx > 0 ? lines[timestampLineIdx - 1].trim() : '';

      // Timestamp parse
      const timeParts = lines[timestampLineIdx].split('-->');
      if (timeParts.length !== 2) continue;

      const startTime = this._parseTimestamp(timeParts[0].trim());
      // Position/alignment bilgilerini temizle
      const endRaw = timeParts[1].trim().split(/\s/)[0];
      const endTime = this._parseTimestamp(endRaw);

      if (startTime === null || endTime === null) continue;

      // Metin satırları (timestamp'tan sonrası)
      const textLines = lines.slice(timestampLineIdx + 1);
      const text = textLines
        .join(' ')
        .replace(/<[^>]+>/g, '')  // HTML tag'lerini strip et
        .trim();

      if (!text) continue;

      cues.push({ id, startTime, endTime, text });
    }

    return cues;
  },

  /**
   * "HH:MM:SS.mmm" veya "MM:SS.mmm" → saniye (float)
   */
  _parseTimestamp(ts) {
    // Biçimler: 00:00:00.000 veya 00:00.000
    const match = ts.match(/(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})/);
    if (!match) return null;

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const millis = parseInt(match[4]);

    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  },

  /**
   * Cue dizisinin gerçek altyazı içerip içermediğini sezgisel olarak doğrular.
   *
   * Mux Player gibi oynatıcılar timeline preview için "storyboard.vtt" üretir
   * ve cue text alanı resim URL'si olur (ör. https://image.mux.com/.../storyboard.jpg?...).
   * Bu içerikler çeviri pipeline'ına sokulmamalı; aksi halde JPG URL'leri OpenAI'a
   * altyazı diye gönderilir ve sahte çeviri üretilir.
   *
   * Heuristik: ilk N cue örneklenir, %60+'i resim URL'si pattern'ine uyuyorsa
   * altyazı değil kabul edilir.
   */
  isLikelySubtitle(cues) {
    if (!cues || cues.length === 0) return false;
    const sampleSize = Math.min(5, cues.length);
    const sample = cues.slice(0, sampleSize);
    const urlPattern = /^https?:\/\/[^\s]+\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i;
    const urlLikeCount = sample.filter(c => urlPattern.test((c.text || '').trim())).length;
    // %60+ resim URL'i ise altyazı değil (storyboard/thumbnail VTT)
    return urlLikeCount < sampleSize * 0.6;
  }
};

if (typeof self !== 'undefined') {
  self.VTTParser = VTTParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VTTParser };
}
