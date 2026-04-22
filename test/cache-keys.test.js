const { LCTCacheKeys } = require('../lib/cache-keys.js');

describe('LCTCacheKeys.translation()', () => {
  it('eski şemayla uyumlu anahtar üretmeli (translation_<id>_tr)', () => {
    expect(LCTCacheKeys.translation('mux_abc123')).toBe('translation_mux_abc123_tr');
  });

  it('laracasts-specific videoId formatları', () => {
    expect(LCTCacheKeys.translation('laracasts_42')).toBe('translation_laracasts_42_tr');
  });

  it('boş videoId için TypeError', () => {
    expect(() => LCTCacheKeys.translation('')).toThrow(TypeError);
    expect(() => LCTCacheKeys.translation(null)).toThrow(TypeError);
  });
});

describe('LCTCacheKeys.isTranslationKey()', () => {
  it('geçerli cache anahtarlarını tanımalı', () => {
    expect(LCTCacheKeys.isTranslationKey('translation_abc_tr')).toBe(true);
    expect(LCTCacheKeys.isTranslationKey('translation_mux_xyz_tr')).toBe(true);
  });

  it('cache olmayan anahtarları reddetmeli', () => {
    expect(LCTCacheKeys.isTranslationKey('_lct_apiKey')).toBe(false);
    expect(LCTCacheKeys.isTranslationKey('translation_abc')).toBe(false);
    expect(LCTCacheKeys.isTranslationKey('abc_tr')).toBe(false);
    expect(LCTCacheKeys.isTranslationKey('translation__tr')).toBe(false);
  });

  it('string olmayan girdileri reddetmeli', () => {
    expect(LCTCacheKeys.isTranslationKey(null)).toBe(false);
    expect(LCTCacheKeys.isTranslationKey(undefined)).toBe(false);
    expect(LCTCacheKeys.isTranslationKey(123)).toBe(false);
  });
});

describe('LCTCacheKeys.extractVideoId()', () => {
  it('geçerli anahtardan videoId çıkarmalı', () => {
    expect(LCTCacheKeys.extractVideoId('translation_mux_xyz_tr')).toBe('mux_xyz');
  });

  it('roundtrip identity', () => {
    const id = 'laracasts_42';
    expect(LCTCacheKeys.extractVideoId(LCTCacheKeys.translation(id))).toBe(id);
  });

  it('geçersiz anahtar için null', () => {
    expect(LCTCacheKeys.extractVideoId('abc')).toBeNull();
  });
});
