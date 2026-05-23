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

describe('LCTTranslationCacheBg langCode parametresi (v0.5.0)', () => {
  it('get langCode parametresiyle farklı dil cache\'i okur', async () => {
    await chrome.storage.local.set({
      'translation_vid_tr': { cues: [{ text: 'a' }], fingerprint: 'f', timestamp: 1 },
      'translation_vid_de': { cues: [{ text: 'b' }], fingerprint: 'f', timestamp: 1 }
    });
    const tr = await LCTTranslationCacheBg.get('vid', 'tr');
    const de = await LCTTranslationCacheBg.get('vid', 'de');
    expect(tr.cues[0].text).toBe('a');
    expect(de.cues[0].text).toBe('b');
  });

  it('set langCode parametresiyle ayrı anahtar yazar', async () => {
    await LCTTranslationCacheBg.set('vid', [{ text: 'de-text' }], 'fp', 'de');
    await LCTTranslationCacheBg.set('vid', [{ text: 'tr-text' }], 'fp', 'tr');
    const all = await chrome.storage.local.get(null);
    expect(all['translation_vid_de'].cues[0].text).toBe('de-text');
    expect(all['translation_vid_tr'].cues[0].text).toBe('tr-text');
  });

  it('set entry içine langCode alanı koyar', async () => {
    await LCTTranslationCacheBg.set('vid', [], 'fp', 'fr');
    const all = await chrome.storage.local.get('translation_vid_fr');
    expect(all['translation_vid_fr'].langCode).toBe('fr');
  });

  it('langCode verilmezse tr default', async () => {
    await LCTTranslationCacheBg.set('vid', [], 'fp');
    const all = await chrome.storage.local.get('translation_vid_tr');
    expect(all['translation_vid_tr']).toBeDefined();
  });

  it('BCP-47 bölgesel kod (zh-CN, pt-BR) doğru saklanır', async () => {
    await LCTTranslationCacheBg.set('vid', [{ text: 'zh' }], 'fp', 'zh-CN');
    const fetched = await LCTTranslationCacheBg.get('vid', 'zh-CN');
    expect(fetched.cues[0].text).toBe('zh');
  });
});
