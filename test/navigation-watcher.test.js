const { createNavigationWatcher } = require('../lib/navigation-watcher.js');

describe('createNavigationWatcher', () => {
  let origPush, origReplace;

  beforeEach(() => {
    // happy-dom history API'sini reset et
    origPush = history.pushState;
    origReplace = history.replaceState;
    if (typeof window !== 'undefined' && window.location && window.location.href) {
      // path başlangıcına çek
      try { history.replaceState({}, '', '/'); } catch (_) {}
    }
  });

  afterEach(() => {
    // patch'leri geri al (watcher.destroy yapmıyorsa)
    if (typeof history !== 'undefined') {
      history.pushState = origPush;
      history.replaceState = origReplace;
    }
  });

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  it('onNavigate olmadan throw eder', () => {
    expect(() => createNavigationWatcher(null)).toThrow(TypeError);
    expect(() => createNavigationWatcher()).toThrow(TypeError);
  });

  it('pushState çağrısı onNavigate tetikler', async () => {
    const calls = [];
    const watcher = createNavigationWatcher((url) => calls.push(url));

    history.pushState({}, '', '/episode/1');
    await sleep(20);

    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('/episode/1');

    watcher.destroy();
  });

  it('3 ardışık pushState 3 trigger üretir (farklı URL\'ler)', async () => {
    const calls = [];
    const watcher = createNavigationWatcher((url) => calls.push(url));

    history.pushState({}, '', '/a');
    history.pushState({}, '', '/b');
    history.pushState({}, '', '/c');
    await sleep(30);

    expect(calls.length).toBe(3);
    expect(calls[0]).toContain('/a');
    expect(calls[1]).toContain('/b');
    expect(calls[2]).toContain('/c');

    watcher.destroy();
  });

  it('aynı URL\'e pushState trigger üretmez', async () => {
    const calls = [];
    const watcher = createNavigationWatcher((url) => calls.push(url));

    history.pushState({}, '', '/same');
    await sleep(20);
    history.pushState({}, '', '/same');
    await sleep(20);
    history.pushState({}, '', '/same');
    await sleep(20);

    expect(calls.length).toBe(1);
    watcher.destroy();
  });

  it('replaceState çağrısı onNavigate tetikler', async () => {
    const calls = [];
    const watcher = createNavigationWatcher((url) => calls.push(url));

    history.replaceState({}, '', '/r1');
    await sleep(20);

    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('/r1');
    watcher.destroy();
  });

  it('popstate eventi onNavigate tetikler', async () => {
    const calls = [];
    const watcher = createNavigationWatcher((url) => calls.push(url), { popstateDelayMs: 0 });

    // URL'i değiştir (popstate ile algılanması için lastUrl'den farklı olmalı)
    history.pushState({}, '', '/before-pop');
    await sleep(10);
    calls.length = 0;

    history.replaceState({}, '', '/after-pop');
    window.dispatchEvent(new Event('popstate'));
    await sleep(20);

    expect(calls.length).toBeGreaterThanOrEqual(1);
    watcher.destroy();
  });

  it('destroy sonrası patch geri alınır, trigger üretmez', async () => {
    const calls = [];
    const watcher = createNavigationWatcher((url) => calls.push(url));

    history.pushState({}, '', '/before-destroy');
    await sleep(20);
    expect(calls.length).toBe(1);

    watcher.destroy();

    history.pushState({}, '', '/after-destroy');
    await sleep(20);

    expect(calls.length).toBe(1); // değişmemeli
  });

  it('onNavigate throw etse de watcher hayatta kalır', async () => {
    let callCount = 0;
    const watcher = createNavigationWatcher(() => {
      callCount++;
      throw new Error('boom');
    });

    history.pushState({}, '', '/throw-1');
    await sleep(20);
    history.pushState({}, '', '/throw-2');
    await sleep(20);

    expect(callCount).toBe(2);
    watcher.destroy();
  });

  it('getLastUrl son URL\'i döndürür', async () => {
    const watcher = createNavigationWatcher(() => {});

    history.pushState({}, '', '/last-url-test');
    await sleep(20);

    expect(watcher.getLastUrl()).toContain('/last-url-test');
    watcher.destroy();
  });
});
