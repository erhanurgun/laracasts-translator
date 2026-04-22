const { LCTLogSanitizer } = require('../lib/log-sanitizer.js');

describe('LCTLogSanitizer.sanitizeUrl()', () => {
  it('query parametrelerini maskelemeli', () => {
    const url = 'https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&tlang=en&fmt=vtt';
    expect(LCTLogSanitizer.sanitizeUrl(url)).toBe('https://www.youtube.com/api/timedtext?[redacted]');
  });

  it('query olmadan URL\'i bozmamalı', () => {
    const url = 'https://www.youtube.com/watch';
    expect(LCTLogSanitizer.sanitizeUrl(url)).toBe('https://www.youtube.com/watch?[redacted]');
  });

  it('geçersiz URL için marker dönmeli', () => {
    expect(LCTLogSanitizer.sanitizeUrl('not-a-url')).toBe('[invalid-url]');
  });

  it('null/undefined/empty için boş string dönmeli', () => {
    expect(LCTLogSanitizer.sanitizeUrl(null)).toBe('');
    expect(LCTLogSanitizer.sanitizeUrl(undefined)).toBe('');
    expect(LCTLogSanitizer.sanitizeUrl('')).toBe('');
  });
});

describe('LCTLogSanitizer.sanitizeVideoId()', () => {
  it('videoId\'nin ilk 4 karakterini göstermeli', () => {
    expect(LCTLogSanitizer.sanitizeVideoId('dQw4w9WgXcQ')).toBe('dQw4...');
  });

  it('kısa videoId\'ler için suffix koymalı', () => {
    expect(LCTLogSanitizer.sanitizeVideoId('abc')).toBe('abc...');
  });

  it('boş/null için marker dönmeli', () => {
    expect(LCTLogSanitizer.sanitizeVideoId('')).toBe('[no-id]');
    expect(LCTLogSanitizer.sanitizeVideoId(null)).toBe('[no-id]');
  });
});

describe('LCTLogSanitizer.sanitizeApiKey()', () => {
  it('uzun key\'in başını ve sonunu gösterip ortasını gizlemeli', () => {
    expect(LCTLogSanitizer.sanitizeApiKey('sk-abc1234567890xyz')).toBe('sk-...xyz');
  });

  it('kısa key için marker dönmeli', () => {
    expect(LCTLogSanitizer.sanitizeApiKey('abc123')).toBe('[short]');
  });

  it('boş için marker dönmeli', () => {
    expect(LCTLogSanitizer.sanitizeApiKey('')).toBe('[none]');
    expect(LCTLogSanitizer.sanitizeApiKey(null)).toBe('[none]');
  });
});

describe('LCTLogSanitizer.sanitizeText()', () => {
  it('API key token\'ları maskelemeli', () => {
    const input = 'Error: invalid key sk-abc123def456ghi789 returned 401';
    expect(LCTLogSanitizer.sanitizeText(input)).toBe('Error: invalid key [api-key] returned 401');
  });

  it('Bearer token\'ları maskelemeli', () => {
    const input = 'Authorization: Bearer abc123xyz.jwt.token';
    expect(LCTLogSanitizer.sanitizeText(input)).toContain('Bearer [redacted]');
  });

  it('email adreslerini maskelemeli', () => {
    const input = 'User john.doe@example.com logged in';
    const out = LCTLogSanitizer.sanitizeText(input);
    expect(out).toContain('j***@example.com');
    expect(out).not.toContain('john.doe@');
  });

  it('normal metni bozmamalı', () => {
    const input = 'Normal log message without secrets';
    expect(LCTLogSanitizer.sanitizeText(input)).toBe(input);
  });

  it('null/undefined için boş string dönmeli', () => {
    expect(LCTLogSanitizer.sanitizeText(null)).toBe('');
    expect(LCTLogSanitizer.sanitizeText(undefined)).toBe('');
  });
});
