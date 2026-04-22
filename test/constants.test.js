const { LCTConstants } = require('../lib/constants.js');

describe('LCTConstants', () => {
  it('kökte immutable (frozen) olmalı', () => {
    expect(Object.isFrozen(LCTConstants)).toBe(true);
  });

  it('BATCH_SIZE 50 olmalı', () => {
    expect(LCTConstants.BATCH_SIZE).toBe(50);
  });

  it('OpenAI endpoint doğru olmalı', () => {
    expect(LCTConstants.OPENAI_ENDPOINT).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('cache prefix translation_ olmalı (yt-translator\'dan farklı)', () => {
    expect(LCTConstants.CACHE_KEY_PREFIX).toBe('translation_');
    expect(LCTConstants.CACHE_KEY_SUFFIX).toBe('_tr');
  });

  it('trusted origin sadece laracasts.com olmalı', () => {
    expect(LCTConstants.TRUSTED_ORIGINS).toContain('https://laracasts.com');
    expect(LCTConstants.TRUSTED_ORIGINS).toContain('https://www.laracasts.com');
  });

  it('LARACASTS_ORIGIN_REGEX güvenli origin\'leri eşleştirmeli', () => {
    expect(LCTConstants.LARACASTS_ORIGIN_REGEX.test('https://laracasts.com')).toBe(true);
    expect(LCTConstants.LARACASTS_ORIGIN_REGEX.test('https://www.laracasts.com')).toBe(true);
    expect(LCTConstants.LARACASTS_ORIGIN_REGEX.test('https://evil.com')).toBe(false);
    expect(LCTConstants.LARACASTS_ORIGIN_REGEX.test('https://laracasts.com.evil')).toBe(false);
  });

  it('DEFAULT_SETTINGS translationColor gold/#ffd700 olmalı', () => {
    expect(LCTConstants.DEFAULT_SETTINGS.translationColor).toBe('#ffd700');
  });

  it('fingerprint sürümü v2 olmalı (Laracasts mevcut)', () => {
    expect(LCTConstants.FINGERPRINT_VERSION).toBe('v2');
  });

  it('keepalive alarm lct-keepalive olmalı', () => {
    expect(LCTConstants.KEEPALIVE_ALARM).toBe('lct-keepalive');
  });

  it('storage key legacy _lct_apiKey olmalı', () => {
    expect(LCTConstants.STORAGE_KEY_LEGACY_API).toBe('_lct_apiKey');
  });
});
