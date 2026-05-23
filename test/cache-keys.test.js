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

describe('LCTCacheKeys.translation() langCode parametresi', () => {
  it('langCode verilmezse tr default', () => {
    expect(LCTCacheKeys.translation('abc')).toBe('translation_abc_tr');
  });

  it('langCode de -> translation_abc_de', () => {
    expect(LCTCacheKeys.translation('abc', 'de')).toBe('translation_abc_de');
  });

  it('BCP-47 bölgesel kod (zh-CN, pt-BR) korunur', () => {
    expect(LCTCacheKeys.translation('abc', 'zh-CN')).toBe('translation_abc_zh-CN');
    expect(LCTCacheKeys.translation('abc', 'pt-BR')).toBe('translation_abc_pt-BR');
  });

  it('geçersiz langCode için tr fallback (kod bozulması engellenir)', () => {
    expect(LCTCacheKeys.translation('abc', 'XX')).toBe('translation_abc_tr');
    expect(LCTCacheKeys.translation('abc', '')).toBe('translation_abc_tr');
    expect(LCTCacheKeys.translation('abc', null)).toBe('translation_abc_tr');
    expect(LCTCacheKeys.translation('abc', 123)).toBe('translation_abc_tr');
  });
});

describe('LCTCacheKeys.isTranslationKey() çoklu dil', () => {
  it('farklı dil suffix\'lerini tanır', () => {
    expect(LCTCacheKeys.isTranslationKey('translation_abc_tr')).toBe(true);
    expect(LCTCacheKeys.isTranslationKey('translation_abc_de')).toBe(true);
    expect(LCTCacheKeys.isTranslationKey('translation_abc_zh-CN')).toBe(true);
    expect(LCTCacheKeys.isTranslationKey('translation_mux_xyz_pt-BR')).toBe(true);
  });

  it('geçersiz langCode formatına sahip anahtarları reddeder', () => {
    expect(LCTCacheKeys.isTranslationKey('translation_abc_XX')).toBe(false);
    expect(LCTCacheKeys.isTranslationKey('translation_abc_TUR')).toBe(false);
    expect(LCTCacheKeys.isTranslationKey('translation_abc_x')).toBe(false);
  });
});

describe('LCTCacheKeys.extractLangCode()', () => {
  it('geçerli anahtardan langCode çıkarır', () => {
    expect(LCTCacheKeys.extractLangCode('translation_abc_tr')).toBe('tr');
    expect(LCTCacheKeys.extractLangCode('translation_mux_xyz_de')).toBe('de');
    expect(LCTCacheKeys.extractLangCode('translation_mux_xyz_zh-CN')).toBe('zh-CN');
  });

  it('geçersiz anahtar için null', () => {
    expect(LCTCacheKeys.extractLangCode('abc')).toBeNull();
    expect(LCTCacheKeys.extractLangCode('translation_abc')).toBeNull();
  });

  it('roundtrip: translation -> extract aynı kod', () => {
    expect(LCTCacheKeys.extractLangCode(LCTCacheKeys.translation('foo', 'fr'))).toBe('fr');
    expect(LCTCacheKeys.extractLangCode(LCTCacheKeys.translation('foo', 'pt-BR'))).toBe('pt-BR');
  });
});
