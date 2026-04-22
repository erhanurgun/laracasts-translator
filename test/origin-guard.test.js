const { LCTOriginGuard } = require('../lib/origin-guard.js');

describe('LCTOriginGuard.isTrustedLaracastsOrigin()', () => {
  it('laracasts.com ve www.laracasts.com kabul', () => {
    expect(LCTOriginGuard.isTrustedLaracastsOrigin('https://laracasts.com')).toBe(true);
    expect(LCTOriginGuard.isTrustedLaracastsOrigin('https://www.laracasts.com')).toBe(true);
  });

  it('evil origin\'leri reddet', () => {
    expect(LCTOriginGuard.isTrustedLaracastsOrigin('https://evil.com')).toBe(false);
    expect(LCTOriginGuard.isTrustedLaracastsOrigin('https://laracasts.com.evil')).toBe(false);
    expect(LCTOriginGuard.isTrustedLaracastsOrigin('http://laracasts.com')).toBe(false);
    expect(LCTOriginGuard.isTrustedLaracastsOrigin('https://fake-laracasts.com')).toBe(false);
  });

  it('null/undefined/empty için false', () => {
    expect(LCTOriginGuard.isTrustedLaracastsOrigin(null)).toBe(false);
    expect(LCTOriginGuard.isTrustedLaracastsOrigin('')).toBe(false);
    expect(LCTOriginGuard.isTrustedLaracastsOrigin(123)).toBe(false);
  });
});

describe('LCTOriginGuard.isTrustedLaracastsUrl()', () => {
  it('geçerli URL\'leri kabul', () => {
    expect(LCTOriginGuard.isTrustedLaracastsUrl('https://laracasts.com/series/abc')).toBe(true);
    expect(LCTOriginGuard.isTrustedLaracastsUrl('https://www.laracasts.com/')).toBe(true);
  });

  it('güvensiz URL\'leri reddet', () => {
    expect(LCTOriginGuard.isTrustedLaracastsUrl('https://evil.com/laracasts.com')).toBe(false);
    expect(LCTOriginGuard.isTrustedLaracastsUrl('http://laracasts.com/')).toBe(false);
  });
});

describe('LCTOriginGuard.isValidPageMessage()', () => {
  const ALLOWED = ['LCT_FOO', 'LCT_BAR'];

  it('geçerli origin + type için true', () => {
    const event = {
      origin: 'https://laracasts.com',
      data: { type: 'LCT_FOO', payload: 1 }
    };
    expect(LCTOriginGuard.isValidPageMessage(event, ALLOWED)).toBe(true);
  });

  it('evil origin için false', () => {
    const event = { origin: 'https://evil.com', data: { type: 'LCT_FOO' } };
    expect(LCTOriginGuard.isValidPageMessage(event, ALLOWED)).toBe(false);
  });

  it('izinsiz type için false', () => {
    const event = { origin: 'https://laracasts.com', data: { type: 'EVIL' } };
    expect(LCTOriginGuard.isValidPageMessage(event, ALLOWED)).toBe(false);
  });

  it('data yoksa false', () => {
    expect(LCTOriginGuard.isValidPageMessage({ origin: 'https://laracasts.com', data: null }, ALLOWED)).toBe(false);
  });

  it('aynı-frame boş origin toleransı', () => {
    const event = { origin: '', data: { type: 'LCT_FOO' } };
    expect(LCTOriginGuard.isValidPageMessage(event, ALLOWED)).toBe(true);
  });
});

describe('LCTOriginGuard.isValidRuntimeSender()', () => {
  it('laracasts URL için true', () => {
    expect(LCTOriginGuard.isValidRuntimeSender({ url: 'https://laracasts.com/series/a' })).toBe(true);
  });

  it('evil URL için false', () => {
    expect(LCTOriginGuard.isValidRuntimeSender({ url: 'https://evil.com' })).toBe(false);
  });

  it('extension id eşleşmesi', () => {
    const chromeId = globalThis.chrome?.runtime?.id;
    expect(LCTOriginGuard.isValidRuntimeSender({ id: chromeId })).toBe(true);
    expect(LCTOriginGuard.isValidRuntimeSender({ id: 'other-ext' })).toBe(false);
  });
});
