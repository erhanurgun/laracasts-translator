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
  }
};
