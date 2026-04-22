const { LCTFingerprint } = require('../lib/fingerprint.js');

describe('LCTFingerprint.create()', () => {
  it('v2: prefix kullanmalı (Laracasts mevcut sürümle uyumlu)', () => {
    const result = LCTFingerprint.create([{ text: 'hello' }]);
    expect(result).toMatch(/^v2:1:-?\d+$/);
  });

  it('boş dizi için v2:0:0 dönmeli', () => {
    expect(LCTFingerprint.create([])).toBe('v2:0:0');
  });

  it('aynı girdi için deterministik', () => {
    const cues = [{ text: 'foo' }, { text: 'bar' }];
    expect(LCTFingerprint.create(cues)).toBe(LCTFingerprint.create(cues));
  });

  it('metin değişiminde farklı hash', () => {
    const a = LCTFingerprint.create([{ text: 'foo' }]);
    const b = LCTFingerprint.create([{ text: 'bar' }]);
    expect(a).not.toBe(b);
  });

  it('Türkçe karakterleri koruyarak hash', () => {
    expect(LCTFingerprint.create([{ text: 'çğıöşü' }])).toMatch(/^v2:1:-?\d+$/);
  });

  it('dizi olmayan girdi için TypeError', () => {
    expect(() => LCTFingerprint.create(null)).toThrow(TypeError);
    expect(() => LCTFingerprint.create('str')).toThrow(TypeError);
  });

  it('eski v2 algoritmasıyla birebir uyumlu (cache invalidation yok)', () => {
    const cues = [{ text: 'Laravel' }, { text: 'Eloquent' }];
    const legacy = (() => {
      const allText = cues.map(c => c.text).join('|');
      let hash = 0;
      for (let i = 0; i < allText.length; i++) {
        hash = ((hash << 5) - hash + allText.charCodeAt(i)) | 0;
      }
      return `v2:${cues.length}:${hash}`;
    })();
    expect(LCTFingerprint.create(cues)).toBe(legacy);
  });
});
