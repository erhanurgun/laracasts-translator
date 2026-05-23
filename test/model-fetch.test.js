const { LCTModelFetch } = require('../lib/model-fetch.js');
const { LCTConstants } = require('../lib/constants.js');

// LCTConstants global olarak görünür olmalı (model-fetch içinde getLib ile çekiliyor)
globalThis.self = globalThis;
globalThis.self.LCTConstants = LCTConstants;

describe('LCTModelFetch.filterModels()', () => {
  it('gpt- ile başlayan modelleri tutar', () => {
    const result = LCTModelFetch.filterModels([
      { id: 'gpt-4o' },
      { id: 'gpt-4o-mini' },
      { id: 'gpt-3.5-turbo' }
    ]);
    expect(result).toContain('gpt-4o');
    expect(result).toContain('gpt-4o-mini');
    expect(result).toContain('gpt-3.5-turbo');
  });

  it('o-serisi reasoning modellerini tutar (o1, o3, o4)', () => {
    const result = LCTModelFetch.filterModels([
      { id: 'o1-preview' },
      { id: 'o3-mini' },
      { id: 'o4-mini' }
    ]);
    expect(result).toEqual(['o1-preview', 'o3-mini', 'o4-mini']);
  });

  it('chatgpt- ile başlayan modelleri tutar', () => {
    const result = LCTModelFetch.filterModels([{ id: 'chatgpt-4o-latest' }]);
    expect(result).toContain('chatgpt-4o-latest');
  });

  it('embedding/whisper/tts/dall-e/realtime modellerini eler', () => {
    const result = LCTModelFetch.filterModels([
      { id: 'gpt-4o' },
      { id: 'text-embedding-3-large' },
      { id: 'whisper-1' },
      { id: 'tts-1' },
      { id: 'dall-e-3' },
      { id: 'gpt-4o-realtime-preview' },
      { id: 'gpt-4o-audio-preview' },
      { id: 'gpt-4o-transcribe' }
    ]);
    expect(result).toEqual(['gpt-4o']);
  });

  it('legacy davinci/babbage/curie/ada modellerini eler', () => {
    const result = LCTModelFetch.filterModels([
      { id: 'gpt-4o' },
      { id: 'davinci-002' },
      { id: 'babbage-002' },
      { id: 'ada-002' },
      { id: 'curie-001' }
    ]);
    expect(result).toEqual(['gpt-4o']);
  });

  it('sıralı döner', () => {
    const result = LCTModelFetch.filterModels([
      { id: 'gpt-4o-mini' },
      { id: 'gpt-3.5-turbo' },
      { id: 'gpt-4o' }
    ]);
    expect(result).toEqual(['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini']);
  });

  it('tekrarlı id\'leri tek olarak döner', () => {
    const result = LCTModelFetch.filterModels([
      { id: 'gpt-4o' },
      { id: 'gpt-4o' },
      { id: 'gpt-4o-mini' }
    ]);
    expect(result.filter(id => id === 'gpt-4o').length).toBe(1);
  });

  it('string array de kabul eder', () => {
    const result = LCTModelFetch.filterModels(['gpt-4o', 'whisper-1']);
    expect(result).toEqual(['gpt-4o']);
  });

  it('array dışındaki girdi için boş döner', () => {
    expect(LCTModelFetch.filterModels(null)).toEqual([]);
    expect(LCTModelFetch.filterModels(undefined)).toEqual([]);
    expect(LCTModelFetch.filterModels('gpt-4o')).toEqual([]);
  });
});

describe('LCTModelFetch.fetchFromOpenAI()', () => {
  it('200 + data ile filtered model listesi döner', async () => {
    const fakeFetch = async (url, init) => {
      expect(url).toBe('https://api.openai.com/v1/models');
      expect(init.headers.Authorization).toBe('Bearer sk-test');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'gpt-4o' },
            { id: 'gpt-4o-mini' },
            { id: 'whisper-1' }
          ]
        })
      };
    };
    const result = await LCTModelFetch.fetchFromOpenAI('sk-test', fakeFetch);
    expect(result).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('401 yanıtında throw', async () => {
    const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await expect(LCTModelFetch.fetchFromOpenAI('sk-bad', fakeFetch))
      .rejects.toThrow(/401/);
  });

  it('data yoksa boş array', async () => {
    const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
    const result = await LCTModelFetch.fetchFromOpenAI('sk-test', fakeFetch);
    expect(result).toEqual([]);
  });
});

describe('LCTModelFetch.readCache/writeCache/clearCache', () => {
  it('writeCache + readCache: TTL içinde entry döner', async () => {
    await LCTModelFetch.writeCache(['gpt-4o'], 'api');
    const entry = await LCTModelFetch.readCache();
    expect(entry).not.toBeNull();
    expect(entry.models).toEqual(['gpt-4o']);
    expect(entry.source).toBe('api');
    expect(typeof entry.timestamp).toBe('number');
  });

  it('readCache: cache yoksa null', async () => {
    const entry = await LCTModelFetch.readCache();
    expect(entry).toBeNull();
  });

  it('readCache: TTL geçmişse null', async () => {
    const expired = Date.now() - (25 * 60 * 60 * 1000);
    await chrome.storage.local.set({
      [LCTConstants.STORAGE_KEY_MODELS_CACHE]: { models: ['gpt-4o'], source: 'api', timestamp: expired }
    });
    const entry = await LCTModelFetch.readCache();
    expect(entry).toBeNull();
  });

  it('clearCache cache\'i siler', async () => {
    await LCTModelFetch.writeCache(['gpt-4o'], 'api');
    await LCTModelFetch.clearCache();
    const entry = await LCTModelFetch.readCache();
    expect(entry).toBeNull();
  });
});

describe('LCTModelFetch.getCachedOrFetch()', () => {
  it('forceRefresh=false + taze cache -> cache döner', async () => {
    await LCTModelFetch.writeCache(['gpt-4o-cached'], 'api');
    const fakeFetch = async () => { throw new Error('cache hit olduğunda fetch çağrılmamalı'); };
    const result = await LCTModelFetch.getCachedOrFetch('sk-test', false, fakeFetch);
    expect(result.fromCache).toBe(true);
    expect(result.source).toBe('api');
    expect(result.models).toEqual(['gpt-4o-cached']);
  });

  it('forceRefresh=true -> API\'ye gider, cache atlanır', async () => {
    await LCTModelFetch.writeCache(['gpt-4o-stale'], 'api');
    let called = false;
    const fakeFetch = async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 'gpt-4o-fresh' }] }) };
    };
    const result = await LCTModelFetch.getCachedOrFetch('sk-test', true, fakeFetch);
    expect(called).toBe(true);
    expect(result.fromCache).toBe(false);
    expect(result.source).toBe('api');
    expect(result.models).toEqual(['gpt-4o-fresh']);
  });

  it('API hatası -> fallback liste döner', async () => {
    const fakeFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const result = await LCTModelFetch.getCachedOrFetch('sk-test', true, fakeFetch);
    expect(result.fromFallback).toBe(true);
    expect(result.source).toBe('fallback');
    expect(result.models).toContain('gpt-4o');
    expect(result.error).toMatch(/500/);
  });

  it('boş API listesi -> fallback', async () => {
    const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: 'whisper-1' }] }) });
    const result = await LCTModelFetch.getCachedOrFetch('sk-test', true, fakeFetch);
    expect(result.fromFallback).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
  });

  it('fallback sonrası cache içinde source=fallback olarak yazılır', async () => {
    const fakeFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await LCTModelFetch.getCachedOrFetch('sk-test', true, fakeFetch);
    const entry = await LCTModelFetch.readCache();
    expect(entry).not.toBeNull();
    expect(entry.source).toBe('fallback');
  });
});
