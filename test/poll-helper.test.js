const { createPoll } = require('../lib/poll-helper.js');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

describe('createPoll', () => {
  it('callback olmadan throw eder', () => {
    expect(() => createPoll(null, 100)).toThrow(TypeError);
    expect(() => createPoll(undefined, 100)).toThrow(TypeError);
  });

  it('intervalMs pozitif olmazsa throw eder', () => {
    expect(() => createPoll(() => {}, 0)).toThrow(TypeError);
    expect(() => createPoll(() => {}, -1)).toThrow(TypeError);
    expect(() => createPoll(() => {}, 'a')).toThrow(TypeError);
  });

  it('belirli aralıklarla fn çağırır', async () => {
    let count = 0;
    const poll = createPoll(() => count++, 30);
    await sleep(100);
    expect(count).toBeGreaterThanOrEqual(2);
    poll.stop();
  });

  it('stop() sonrası çağırmayı durdurur', async () => {
    let count = 0;
    const poll = createPoll(() => count++, 30);
    await sleep(80);
    const snapshot = count;
    poll.stop();
    await sleep(80);
    expect(count).toBe(snapshot);
    expect(poll.isStopped()).toBe(true);
    expect(poll.isRunning()).toBe(false);
  });

  it('startImmediately: false ile pasif başlar, forceStart ile başlar', async () => {
    let count = 0;
    const poll = createPoll(() => count++, 30, { startImmediately: false });
    expect(poll.isRunning()).toBe(false);
    await sleep(60);
    expect(count).toBe(0);

    poll.forceStart();
    await sleep(80);
    expect(count).toBeGreaterThanOrEqual(2);

    poll.stop();
  });

  it('runWhenHidden: false (default) iken hidden olduğunda pause olur', async () => {
    // visibilityState='hidden' simülasyonu happy-dom'da
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true
    });

    let count = 0;
    const poll = createPoll(() => count++, 30);
    await sleep(80);
    // hidden iken hiç tick almamış olmalı
    expect(count).toBe(0);
    expect(poll.isRunning()).toBe(false);

    // visible'a çevir
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await sleep(80);
    expect(count).toBeGreaterThanOrEqual(1);

    poll.stop();
  });

  it('runWhenHidden: true iken hidden olsa da çalışır', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true
    });

    let count = 0;
    const poll = createPoll(() => count++, 30, { runWhenHidden: true });
    await sleep(80);
    expect(count).toBeGreaterThanOrEqual(1);
    poll.stop();

    // Geri visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true
    });
  });

  it('callback throw etse de poll hayatta kalır', async () => {
    let count = 0;
    const poll = createPoll(() => {
      count++;
      throw new Error('boom');
    }, 30);
    await sleep(100);
    expect(count).toBeGreaterThanOrEqual(2);
    poll.stop();
  });
});
