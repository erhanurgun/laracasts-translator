const { LCTLanguages } = require('../lib/languages.js');

describe('LCTLanguages.UI', () => {
  it('TR ve EN içermeli', () => {
    expect(LCTLanguages.UI.find(l => l.code === 'tr')).toBeTruthy();
    expect(LCTLanguages.UI.find(l => l.code === 'en')).toBeTruthy();
  });

  it('frozen olmalı', () => {
    expect(Object.isFrozen(LCTLanguages.UI)).toBe(true);
  });

  it('her UI dilinde code/native/english alanları bulunmalı', () => {
    for (const lang of LCTLanguages.UI) {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('native');
      expect(lang).toHaveProperty('english');
    }
  });
});

describe('LCTLanguages.TARGET', () => {
  it('en az 20 hedef dil içermeli', () => {
    expect(LCTLanguages.TARGET.length).toBeGreaterThanOrEqual(20);
  });

  it('frozen olmalı', () => {
    expect(Object.isFrozen(LCTLanguages.TARGET)).toBe(true);
  });

  it('TR varsayılan olarak listeye dahil olmalı', () => {
    expect(LCTLanguages.TARGET.find(l => l.code === 'tr')).toBeTruthy();
  });

  it('major Avrupa dillerini içermeli (de, es, fr, it, nl)', () => {
    for (const code of ['de', 'es', 'fr', 'it', 'nl']) {
      expect(LCTLanguages.TARGET.find(l => l.code === code)).toBeTruthy();
    }
  });

  it('Asya dillerini içermeli (ja, ko, zh-CN)', () => {
    for (const code of ['ja', 'ko', 'zh-CN']) {
      expect(LCTLanguages.TARGET.find(l => l.code === code)).toBeTruthy();
    }
  });

  it('her hedef dilde code/name/native alanları bulunmalı', () => {
    for (const lang of LCTLanguages.TARGET) {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('name');
      expect(lang).toHaveProperty('native');
      expect(typeof lang.code).toBe('string');
      expect(lang.code.length).toBeGreaterThan(0);
    }
  });

  it('BCP-47 formatında kodlar (xx veya xx-XX)', () => {
    const re = /^[a-z]{2}(-[A-Z]{2})?$/;
    for (const lang of LCTLanguages.TARGET) {
      expect(lang.code).toMatch(re);
    }
  });
});

describe('LCTLanguages.getTargetName()', () => {
  it('tr -> Turkish döndürmeli', () => {
    expect(LCTLanguages.getTargetName('tr')).toBe('Turkish');
  });

  it('de -> German döndürmeli', () => {
    expect(LCTLanguages.getTargetName('de')).toBe('German');
  });

  it('zh-CN -> Chinese (Simplified) döndürmeli', () => {
    expect(LCTLanguages.getTargetName('zh-CN')).toBe('Chinese (Simplified)');
  });

  it('bilinmeyen kod -> Turkish fallback', () => {
    expect(LCTLanguages.getTargetName('xx')).toBe('Turkish');
    expect(LCTLanguages.getTargetName('')).toBe('Turkish');
    expect(LCTLanguages.getTargetName(null)).toBe('Turkish');
    expect(LCTLanguages.getTargetName(undefined)).toBe('Turkish');
  });
});

describe('LCTLanguages.getTargetNative()', () => {
  it('tr -> Türkçe', () => {
    expect(LCTLanguages.getTargetNative('tr')).toBe('Türkçe');
  });

  it('ja -> 日本語', () => {
    expect(LCTLanguages.getTargetNative('ja')).toBe('日本語');
  });

  it('bilinmeyen kod -> Türkçe fallback', () => {
    expect(LCTLanguages.getTargetNative('xx')).toBe('Türkçe');
  });
});

describe('LCTLanguages.isSupportedTarget()', () => {
  it('listede olan kod için true', () => {
    expect(LCTLanguages.isSupportedTarget('tr')).toBe(true);
    expect(LCTLanguages.isSupportedTarget('zh-CN')).toBe(true);
  });

  it('listede olmayan kod için false', () => {
    expect(LCTLanguages.isSupportedTarget('xx')).toBe(false);
    expect(LCTLanguages.isSupportedTarget('')).toBe(false);
    expect(LCTLanguages.isSupportedTarget(null)).toBe(false);
    expect(LCTLanguages.isSupportedTarget(123)).toBe(false);
  });
});

describe('LCTLanguages.isSupportedUi()', () => {
  it('tr ve en için true', () => {
    expect(LCTLanguages.isSupportedUi('tr')).toBe(true);
    expect(LCTLanguages.isSupportedUi('en')).toBe(true);
  });

  it('UI dışındaki kodlar için false', () => {
    expect(LCTLanguages.isSupportedUi('de')).toBe(false);
    expect(LCTLanguages.isSupportedUi('xx')).toBe(false);
    expect(LCTLanguages.isSupportedUi(null)).toBe(false);
  });
});
