const { LCTDeepQuery } = require('../lib/deep-query-selector.js');

describe('LCTDeepQuery.find()', () => {
  it('null/undefined host için null dönmeli', () => {
    expect(LCTDeepQuery.find(null, 'video')).toBeNull();
    expect(LCTDeepQuery.find(undefined, 'video')).toBeNull();
  });

  it('shadowRoot olmayan element için null dönmeli', () => {
    const div = document.createElement('div');
    expect(LCTDeepQuery.find(div, 'video')).toBeNull();
  });

  it('doğrudan shadowRoot içindeki elementi bulur', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const video = document.createElement('video');
    shadow.appendChild(video);
    expect(LCTDeepQuery.find(host, 'video')).toBe(video);
  });

  it('iç içe shadow DOM\'da elementi bulur', () => {
    const outer = document.createElement('div');
    const outerShadow = outer.attachShadow({ mode: 'open' });
    const innerHost = document.createElement('div');
    outerShadow.appendChild(innerHost);
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const video = document.createElement('video');
    innerShadow.appendChild(video);

    expect(LCTDeepQuery.find(outer, 'video')).toBe(video);
  });

  it('bulunamazsa null dönmeli', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const p = document.createElement('p');
    p.textContent = 'no video';
    shadow.appendChild(p);
    expect(LCTDeepQuery.find(host, 'video')).toBeNull();
  });

  it('maxDepth sınırını uygulamalı', () => {
    // 3 seviye derinlikte video, maxDepth=1 ile bulunmamalı
    const l0 = document.createElement('div');
    const s0 = l0.attachShadow({ mode: 'open' });
    const l1 = document.createElement('div');
    s0.appendChild(l1);
    const s1 = l1.attachShadow({ mode: 'open' });
    const l2 = document.createElement('div');
    s1.appendChild(l2);
    const s2 = l2.attachShadow({ mode: 'open' });
    s2.appendChild(document.createElement('video'));

    expect(LCTDeepQuery.find(l0, 'video', 1)).toBeNull();
    expect(LCTDeepQuery.find(l0, 'video', 5)).not.toBeNull();
  });
});
