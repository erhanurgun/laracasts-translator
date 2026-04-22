require('../lib/constants.js');
require('../lib/cache-keys.js');
const { LCTTranslationCacheBg } = require('../lib/translation-cache-bg.js');

describe('LCTTranslationCacheBg.get()', () => {
  it('yoksa null döndürmeli', async () => {
    expect(await LCTTranslationCacheBg.get('abc')).toBeNull();
  });

  it('var olan entry\'yi dönmeli', async () => {
    await chrome.storage.local.set({
      'translation_mux_abc_tr': { cues: [{ text: 'a' }], fingerprint: 'v2:1:1', timestamp: 1 }
    });
    const entry = await LCTTranslationCacheBg.get('mux_abc');
    expect(entry.cues[0].text).toBe('a');
    expect(entry.fingerprint).toBe('v2:1:1');
  });
});

describe('LCTTranslationCacheBg.set()', () => {
  it('cues + fingerprint + timestamp kaydet', async () => {
    await LCTTranslationCacheBg.set('vid1', [{ text: 'hi' }], 'v2:1:42');
    const stored = await chrome.storage.local.get('translation_vid1_tr');
    expect(stored['translation_vid1_tr'].fingerprint).toBe('v2:1:42');
  });

  it('fingerprint yoksa TypeError (Liskov)', async () => {
    await expect(LCTTranslationCacheBg.set('vid', [], '')).rejects.toThrow(TypeError);
    await expect(LCTTranslationCacheBg.set('vid', [], null)).rejects.toThrow(TypeError);
    await expect(LCTTranslationCacheBg.set('vid', [])).rejects.toThrow(TypeError);
  });
});

describe('LCTTranslationCacheBg.evictOldest()', () => {
  it('en eski %25 silmeli', async () => {
    for (let i = 0; i < 8; i++) {
      await chrome.storage.local.set({
        [`translation_vid${i}_tr`]: { cues: [], fingerprint: 'x', timestamp: i * 1000 }
      });
    }
    const removed = await LCTTranslationCacheBg.evictOldest();
    expect(removed).toBe(2);

    const rem = await chrome.storage.local.get(null);
    expect(rem['translation_vid0_tr']).toBeUndefined();
    expect(rem['translation_vid7_tr']).toBeDefined();
  });

  it('non-cache anahtarları etkilemez', async () => {
    await chrome.storage.local.set({
      '_lct_apiKey_enc': 'stays',
      'translation_x_tr': { cues: [], fingerprint: 'f', timestamp: 1 }
    });
    await LCTTranslationCacheBg.evictOldest();
    const after = await chrome.storage.local.get('_lct_apiKey_enc');
    expect(after._lct_apiKey_enc).toBe('stays');
  });
});
