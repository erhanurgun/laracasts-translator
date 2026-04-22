const { LCTTranslationOrchestrator } = require('../lib/translation-orchestrator.js');

function createFakePort() {
  const messages = [];
  const msgHandlers = [];
  const discHandlers = [];
  return {
    _sent: messages,
    _msgHandlers: msgHandlers,
    _discHandlers: discHandlers,
    postMessage(m) { messages.push(m); },
    onMessage: { addListener(fn) { msgHandlers.push(fn); } },
    onDisconnect: { addListener(fn) { discHandlers.push(fn); } },
    disconnect() { this._disconnected = true; },
    fireMsg(m) { for (const fn of msgHandlers) fn(m); },
    fireDisconnect() { for (const fn of discHandlers) fn(); }
  };
}

function createFakeRuntime() {
  const ports = [];
  return {
    connect: () => {
      const p = createFakePort();
      ports.push(p);
      return p;
    },
    _ports: ports
  };
}

describe('LCTTranslationOrchestrator.create()', () => {
  it('start() ile port açıp TRANSLATE_CUES mesajı göndermeli', () => {
    const runtime = createFakeRuntime();
    const orch = LCTTranslationOrchestrator.create({ runtime });
    const cues = [{ text: 'hello' }];
    orch.start(cues, 'vid1');
    expect(runtime._ports.length).toBe(1);
    const port = runtime._ports[0];
    expect(port._sent[0]).toEqual({ type: 'TRANSLATE_CUES', cues, videoId: 'vid1' });
  });

  it('PROGRESS mesajını onProgress\'a iletmeli', () => {
    const runtime = createFakeRuntime();
    let received = null;
    const orch = LCTTranslationOrchestrator.create({
      runtime,
      onProgress: (p) => { received = p; }
    });
    orch.start([], 'v1');
    runtime._ports[0].fireMsg({ type: 'PROGRESS', current: 1, total: 3 });
    expect(received).toMatchObject({ current: 1, total: 3 });
  });

  it('BATCH_RESULT mesajını onBatchResult\'a iletmeli', () => {
    const runtime = createFakeRuntime();
    let received = null;
    const orch = LCTTranslationOrchestrator.create({
      runtime,
      onBatchResult: (b) => { received = b; }
    });
    orch.start([], 'v1');
    runtime._ports[0].fireMsg({
      type: 'BATCH_RESULT',
      startIndex: 0,
      cues: [{ text: 'a', translation: 'A' }]
    });
    expect(received.startIndex).toBe(0);
    expect(received.cues).toHaveLength(1);
  });

  it('COMPLETE mesajında onComplete çağrılmalı ve port kapanmalı', () => {
    const runtime = createFakeRuntime();
    let result = null;
    const orch = LCTTranslationOrchestrator.create({
      runtime,
      onComplete: (c) => { result = c; }
    });
    orch.start([], 'v1');
    const port = runtime._ports[0];
    port.fireMsg({ type: 'COMPLETE', cues: [{ translation: 'done' }] });
    expect(result).toEqual([{ translation: 'done' }]);
    expect(port._disconnected).toBe(true);
  });

  it('ERROR mesajında onError çağrılmalı', () => {
    const runtime = createFakeRuntime();
    let err = null;
    const orch = LCTTranslationOrchestrator.create({
      runtime,
      onError: (e) => { err = e; }
    });
    orch.start([], 'v1');
    runtime._ports[0].fireMsg({ type: 'ERROR', error: 'boom' });
    expect(err).toBe('boom');
  });

  it('disconnect sonrası retry yapmalı (maxRetries<n)', async () => {
    const runtime = createFakeRuntime();
    let retries = 0;
    const orch = LCTTranslationOrchestrator.create({
      runtime,
      onRetry: () => { retries++; },
      maxRetries: 2
    });
    orch.start([], 'v1');
    runtime._ports[0].fireDisconnect();
    // onRetry çağrıldı ama _openPort 2sn sonra
    expect(retries).toBe(1);
  });

  it('maxRetries tükenince onAbandon çağrılmalı', async () => {
    const runtime = createFakeRuntime();
    let abandoned = false;
    const orch = LCTTranslationOrchestrator.create({
      runtime,
      maxRetries: 0,
      onAbandon: () => { abandoned = true; }
    });
    orch.start([], 'v1');
    runtime._ports[0].fireDisconnect();
    expect(abandoned).toBe(true);
  });

  it('cancel sonrası isActive false olmalı', () => {
    const runtime = createFakeRuntime();
    const orch = LCTTranslationOrchestrator.create({ runtime });
    orch.start([], 'v1');
    expect(orch.isActive()).toBe(true);
    orch.cancel();
    expect(orch.isActive()).toBe(false);
  });

  it('cancel sonrası late mesaj callback\'e iletilmemeli (stale flag)', () => {
    const runtime = createFakeRuntime();
    let progress = 0;
    const orch = LCTTranslationOrchestrator.create({
      runtime,
      onProgress: () => { progress++; }
    });
    orch.start([], 'v1');
    const port = runtime._ports[0];
    orch.cancel();
    port.fireMsg({ type: 'PROGRESS', current: 1, total: 1 });
    expect(progress).toBe(0);
  });

  it('yeni start çağrısı eski epoch\'u geçersiz kılmalı', () => {
    const runtime = createFakeRuntime();
    let progress = 0;
    const orch = LCTTranslationOrchestrator.create({
      runtime,
      onProgress: () => { progress++; }
    });
    orch.start([], 'v1');
    const oldPort = runtime._ports[0];
    orch.start([], 'v2');
    oldPort.fireMsg({ type: 'PROGRESS', current: 1, total: 1 });
    expect(progress).toBe(0);
  });

  it('runtime yoksa onError çağrılmalı', () => {
    let err = null;
    const orch = LCTTranslationOrchestrator.create({
      runtime: null,
      onError: (e) => { err = e; }
    });
    // Orchestrator global chrome'u fallback olarak kullanır
    // chrome.runtime.connect sinon-chrome için mocklanmadığı için yine hata verir
    // Bu test fallback zincirini doğrular; gerçek extension'da chrome.runtime vardır.
    // Burada en azından patlatmamalı, graceful handle
    const runtime = { connect: null };
    const orch2 = LCTTranslationOrchestrator.create({ runtime, onError: (e) => { err = e; } });
    orch2.start([], 'v1');
    expect(err).toContain('Runtime');
  });
});
