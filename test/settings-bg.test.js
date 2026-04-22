require('../lib/constants.js');
require('../lib/crypto-vault.js');
const { LCTSettingsBg } = require('../lib/settings-bg.js');

describe('LCTSettingsBg.getApiKey()', () => {
  it('şifreli key varsa çözerek döndürmeli', async () => {
    const vault = self.LCTCryptoVault;
    const plaintext = 'sk-test-123';
    const encBlob = await vault.encrypt(plaintext);
    await chrome.storage.local.set({ _lct_apiKey_enc: encBlob });

    expect(await LCTSettingsBg.getApiKey()).toBe(plaintext);
  });

  it('legacy local plaintext varsa migrate + dön', async () => {
    await chrome.storage.local.set({ _lct_apiKey: 'sk-legacy-local' });
    expect(await LCTSettingsBg.getApiKey()).toBe('sk-legacy-local');

    const stored = await chrome.storage.local.get(['_lct_apiKey', '_lct_apiKey_enc']);
    expect(stored._lct_apiKey).toBeUndefined();
    expect(typeof stored._lct_apiKey_enc).toBe('string');
  });

  it('pre-v0.2.1 sync apiKey varsa migrate + temizle + dön', async () => {
    await chrome.storage.sync.set({ apiKey: 'sk-legacy-sync' });
    expect(await LCTSettingsBg.getApiKey()).toBe('sk-legacy-sync');

    const syncStored = await chrome.storage.sync.get('apiKey');
    expect(syncStored.apiKey).toBeUndefined();
    const localStored = await chrome.storage.local.get('_lct_apiKey_enc');
    expect(typeof localStored._lct_apiKey_enc).toBe('string');
  });

  it('hiçbir key yoksa boş string', async () => {
    expect(await LCTSettingsBg.getApiKey()).toBe('');
  });

  it('bozuk şifreli key legacy fallback\'e düşmeli', async () => {
    await chrome.storage.local.set({
      _lct_apiKey_enc: 'bozuk-b64',
      _lct_apiKey: 'sk-fallback'
    });
    expect(await LCTSettingsBg.getApiKey()).toBe('sk-fallback');
  });
});

describe('LCTSettingsBg.getSettings()', () => {
  it('defaults + apiKey birleşimi', async () => {
    await chrome.storage.sync.set({ fontSize: 32, translationColor: '#ff0000' });
    await chrome.storage.local.set({ _lct_apiKey: 'sk-1' });

    const settings = await LCTSettingsBg.getSettings();
    expect(settings.fontSize).toBe(32);
    expect(settings.translationColor).toBe('#ff0000');
    expect(settings.enabled).toBe(true);
    expect(settings.apiKey).toBe('sk-1');
  });

  it('translationColor default #ffd700 (Laracasts)', async () => {
    const settings = await LCTSettingsBg.getSettings();
    expect(settings.translationColor).toBe('#ffd700');
  });
});
