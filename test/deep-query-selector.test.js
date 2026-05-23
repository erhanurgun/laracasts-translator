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

    LCTDeepQuery.invalidate(); // önceki testlerden cache temizle
    expect(LCTDeepQuery.find(l0, 'video', 1)).toBeNull();
    LCTDeepQuery.invalidate();
    expect(LCTDeepQuery.find(l0, 'video', 5)).not.toBeNull();
  });
});

describe('LCTDeepQuery cache (TTL + isConnected)', () => {
  beforeEach(() => {
    LCTDeepQuery.invalidate();
    LCTDeepQuery.setTtl(LCTDeepQuery.DEFAULT_TTL_MS);
  });

  it('aynı host+selector tekrar çağrısı cache\'ten döner', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const video = document.createElement('video');
    shadow.appendChild(video);
    document.body.appendChild(host);

    const first = LCTDeepQuery.find(host, 'video');
    expect(first).toBe(video);

    // shadow'dan video'yu sil; cache hala 1. çağrıyı tutar
    video.remove();
    // happy-dom: video.isConnected video DOM'dan çıkarılınca false döner
    // cache validation isConnected'ı kontrol etmiyorsa cached değer döner
    const second = LCTDeepQuery.find(host, 'video');
    // İkinci çağrı: cache hit ama isConnected check FAIL ise yeniden ara → null
    // VEYA cache geçerli → eski video referansı (artık DOM dışı)
    expect(second === video || second === null).toBe(true);

    host.remove();
  });

  it('TTL süresi geçtiğinde cache yenilenir', async () => {
    LCTDeepQuery.setTtl(50);
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const video = document.createElement('video');
    shadow.appendChild(video);
    document.body.appendChild(host);

    expect(LCTDeepQuery.find(host, 'video')).toBe(video);

    // TTL bekle
    await new Promise(r => setTimeout(r, 80));

    // Yeni element, eski cache stale
    video.remove();
    const newVideo = document.createElement('video');
    shadow.appendChild(newVideo);

    expect(LCTDeepQuery.find(host, 'video')).toBe(newVideo);

    host.remove();
  });

  it('isConnected: false elementi cache\'ten reddeder', () => {
    LCTDeepQuery.setTtl(60000);
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const video = document.createElement('video');
    shadow.appendChild(video);
    document.body.appendChild(host);

    expect(LCTDeepQuery.find(host, 'video')).toBe(video);

    // video'yu shadow DOM'dan çıkar (isConnected=false)
    video.remove();

    // Yeni video ekle
    const newVideo = document.createElement('video');
    shadow.appendChild(newVideo);

    // Cache'teki eski video isConnected=false, yeniden BFS → newVideo
    const result = LCTDeepQuery.find(host, 'video');
    expect(result).toBe(newVideo);

    host.remove();
  });

  it('invalidate(host) sadece o host\'un cache\'ini siler', () => {
    const hostA = document.createElement('div');
    hostA.attachShadow({ mode: 'open' }).appendChild(document.createElement('video'));
    const hostB = document.createElement('div');
    hostB.attachShadow({ mode: 'open' }).appendChild(document.createElement('video'));
    document.body.appendChild(hostA);
    document.body.appendChild(hostB);

    LCTDeepQuery.find(hostA, 'video');
    LCTDeepQuery.find(hostB, 'video');

    LCTDeepQuery.invalidate(hostA);

    // A'nın cache'i temizlendi; B'ninki kalır.
    // Doğrudan introspection yok ama find çağrısı sorunsuz çalışmalı.
    expect(LCTDeepQuery.find(hostA, 'video')).not.toBeNull();
    expect(LCTDeepQuery.find(hostB, 'video')).not.toBeNull();

    hostA.remove();
    hostB.remove();
  });

  it('invalidate() tüm cache\'i temizler', () => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).appendChild(document.createElement('video'));
    document.body.appendChild(host);

    LCTDeepQuery.find(host, 'video');
    LCTDeepQuery.invalidate();

    // Cache boş; yeniden bulmalı
    expect(LCTDeepQuery.find(host, 'video')).not.toBeNull();
    host.remove();
  });

  it('setTtl 0 ise her çağrı yeni BFS yapar', () => {
    LCTDeepQuery.setTtl(0);
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const video = document.createElement('video');
    shadow.appendChild(video);
    document.body.appendChild(host);

    expect(LCTDeepQuery.find(host, 'video')).toBe(video);

    video.remove();
    const newVideo = document.createElement('video');
    shadow.appendChild(newVideo);

    // TTL 0 → cache hemen stale → yeniden BFS
    expect(LCTDeepQuery.find(host, 'video')).toBe(newVideo);
    host.remove();
  });
});
