/**
 * AES-GCM tabanlı API key şifreleme kasası (Laracasts).
 * Cihaz-scope'lu rastgele 256-bit key; chrome.storage.local'da JWK olarak saklanır.
 * Her encrypt'te rastgele 96-bit IV; çıktı: base64(IV || ciphertext).
 */
const LCTCryptoVault = (() => {
  const ALGORITHM = 'AES-GCM';
  const KEY_LENGTH_BITS = 256;
  const IV_LENGTH_BYTES = 12;
  const VAULT_STORAGE_KEY = '_lct_vault_key';

  function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function getSubtle() {
    const s = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle)
      || (typeof self !== 'undefined' && self.crypto && self.crypto.subtle);
    if (!s) throw new Error('SubtleCrypto bu ortamda kullanılamıyor');
    return s;
  }

  function getRandomBytes(length) {
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto)
      || (typeof self !== 'undefined' && self.crypto);
    const arr = new Uint8Array(length);
    c.getRandomValues(arr);
    return arr;
  }

  async function loadOrCreateKey() {
    const subtle = await getSubtle();
    const stored = await chrome.storage.local.get(VAULT_STORAGE_KEY);
    const existing = stored && stored[VAULT_STORAGE_KEY];

    if (existing && typeof existing === 'object') {
      try {
        return await subtle.importKey('jwk', existing, { name: ALGORITHM }, true, ['encrypt', 'decrypt']);
      } catch (_) {}
    }

    const key = await subtle.generateKey(
      { name: ALGORITHM, length: KEY_LENGTH_BITS },
      true,
      ['encrypt', 'decrypt']
    );
    const jwk = await subtle.exportKey('jwk', key);
    await chrome.storage.local.set({ [VAULT_STORAGE_KEY]: jwk });
    return key;
  }

  async function encrypt(plaintext) {
    if (typeof plaintext !== 'string') throw new TypeError('plaintext string olmalı');
    if (plaintext.length === 0) return '';

    const subtle = await getSubtle();
    const key = await loadOrCreateKey();
    const iv = getRandomBytes(IV_LENGTH_BYTES);
    const data = new TextEncoder().encode(plaintext);
    const ctBuffer = await subtle.encrypt({ name: ALGORITHM, iv }, key, data);
    const ct = new Uint8Array(ctBuffer);

    const out = new Uint8Array(iv.length + ct.length);
    out.set(iv, 0);
    out.set(ct, iv.length);
    return bytesToBase64(out);
  }

  async function decrypt(blobB64) {
    if (typeof blobB64 !== 'string' || blobB64.length === 0) return '';

    const combined = base64ToBytes(blobB64);
    if (combined.length <= IV_LENGTH_BYTES) {
      throw new Error('Şifreli veri geçersiz (çok kısa)');
    }
    const iv = combined.slice(0, IV_LENGTH_BYTES);
    const ct = combined.slice(IV_LENGTH_BYTES);

    const subtle = await getSubtle();
    const key = await loadOrCreateKey();
    const ptBuffer = await subtle.decrypt({ name: ALGORITHM, iv }, key, ct);
    return new TextDecoder().decode(ptBuffer);
  }

  async function resetKey() {
    await chrome.storage.local.remove(VAULT_STORAGE_KEY);
  }

  return Object.freeze({
    VAULT_STORAGE_KEY,
    encrypt,
    decrypt,
    resetKey
  });
})();

if (typeof self !== 'undefined') {
  self.LCTCryptoVault = LCTCryptoVault;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LCTCryptoVault };
}
