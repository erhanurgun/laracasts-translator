const { LCTCryptoVault } = require('../lib/crypto-vault.js');

describe('LCTCryptoVault', () => {
  describe('encrypt() / decrypt()', () => {
    it('boş string için boş dönmeli', async () => {
      expect(await LCTCryptoVault.encrypt('')).toBe('');
      expect(await LCTCryptoVault.decrypt('')).toBe('');
    });

    it('roundtrip doğru olmalı', async () => {
      const plaintext = 'sk-test-abc123XYZ';
      const blob = await LCTCryptoVault.encrypt(plaintext);
      expect(await LCTCryptoVault.decrypt(blob)).toBe(plaintext);
    });

    it('Türkçe karakterleri korumalı', async () => {
      const plaintext = 'çğıöşü-ÇĞIİÖŞÜ';
      const blob = await LCTCryptoVault.encrypt(plaintext);
      expect(await LCTCryptoVault.decrypt(blob)).toBe(plaintext);
    });

    it('her şifrelemede farklı ciphertext', async () => {
      const plaintext = 'sk-test-abc';
      const a = await LCTCryptoVault.encrypt(plaintext);
      const b = await LCTCryptoVault.encrypt(plaintext);
      expect(a).not.toBe(b);
    });

    it('ciphertext plaintext\'i içermemeli', async () => {
      const plaintext = 'sk-test-secret-key-12345';
      const blob = await LCTCryptoVault.encrypt(plaintext);
      expect(blob.includes(plaintext)).toBe(false);
    });

    it('string olmayan plaintext için TypeError', async () => {
      await expect(LCTCryptoVault.encrypt(null)).rejects.toThrow(TypeError);
      await expect(LCTCryptoVault.encrypt(undefined)).rejects.toThrow(TypeError);
    });

    it('bozuk ciphertext için hata', async () => {
      await expect(LCTCryptoVault.decrypt('aaaa')).rejects.toThrow();
    });
  });

  describe('vault key kalıcılığı', () => {
    it('vault key _lct_vault_key altında saklanmalı (yt\'den farklı)', async () => {
      await LCTCryptoVault.encrypt('foo');
      const stored = await chrome.storage.local.get('_lct_vault_key');
      expect(stored._lct_vault_key).toBeDefined();
    });

    it('resetKey sonrası yeni key', async () => {
      const blob1 = await LCTCryptoVault.encrypt('test');
      await LCTCryptoVault.resetKey();
      const blob2 = await LCTCryptoVault.encrypt('test');
      await expect(LCTCryptoVault.decrypt(blob1)).rejects.toThrow();
      expect(await LCTCryptoVault.decrypt(blob2)).toBe('test');
    });
  });
});
