/**
 * Vitest global setup. Her test dosyasından önce yüklenir.
 * Minimal in-memory chrome.* mock sağlar (sinon-chrome yerine: daha öngörülebilir).
 *
 * vitest ESM-only; `globals: true` aktif, beforeEach/afterAll globalden alınır.
 */

function createStorageArea() {
  const store = {};
  return {
    _store: store,
    async get(keysOrDefaults) {
      if (keysOrDefaults === null || keysOrDefaults === undefined) {
        return { ...store };
      }
      if (typeof keysOrDefaults === 'string') {
        const result = {};
        if (store[keysOrDefaults] !== undefined) result[keysOrDefaults] = store[keysOrDefaults];
        return result;
      }
      if (Array.isArray(keysOrDefaults)) {
        const result = {};
        for (const k of keysOrDefaults) {
          if (store[k] !== undefined) result[k] = store[k];
        }
        return result;
      }
      const result = {};
      for (const k of Object.keys(keysOrDefaults)) {
        result[k] = store[k] !== undefined ? store[k] : keysOrDefaults[k];
      }
      return result;
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) store[k] = v;
    },
    async remove(keys) {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) delete store[k];
    },
    async clear() {
      for (const k of Object.keys(store)) delete store[k];
    }
  };
}

function createChromeStub() {
  const listeners = [];
  return {
    storage: {
      local: createStorageArea(),
      sync: createStorageArea(),
      onChanged: {
        addListener(fn) { listeners.push(fn); },
        removeListener(fn) {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        }
      }
    },
    alarms: {
      create() {},
      clear() {},
      onAlarm: { addListener() {} }
    },
    runtime: {
      id: 'test-extension-id',
      lastError: null,
      onMessage: { addListener() {} },
      onConnect: { addListener() {} },
      sendMessage: async () => {},
      connect: () => ({ postMessage() {}, onMessage: { addListener() {} }, onDisconnect: { addListener() {} }, disconnect() {} })
    },
    tabs: {
      query: async () => [],
      sendMessage: async () => {}
    }
  };
}

beforeEach(() => {
  globalThis.chrome = createChromeStub();
});
