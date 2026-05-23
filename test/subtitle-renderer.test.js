const { createSubtitleRenderer } = require('../lib/subtitle-renderer.js');

function wrapTextContent(el) {
  let value = '';
  let count = 0;
  Object.defineProperty(el, 'textContent', {
    get() { return value; },
    set(v) {
      value = v;
      count++;
    },
    configurable: true
  });
  el.getSetCount = () => count;
  el.getCurrentValue = () => value;
}

describe('createSubtitleRenderer', () => {
  let container, video;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    video = document.createElement('video');
    container.appendChild(video);
  });

  afterEach(() => {
    container.remove();
  });

  it('public API döner (update/updateStyle/destroy)', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25 });
    expect(typeof r.update).toBe('function');
    expect(typeof r.updateStyle).toBe('function');
    expect(typeof r.destroy).toBe('function');
    r.destroy();
  });

  it('overlay container DOM\'a eklenir', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25 });
    expect(container.querySelector('#lct-subtitle-container')).not.toBeNull();
    expect(container.querySelector('#lct-subtitle-original')).not.toBeNull();
    expect(container.querySelector('#lct-subtitle-translation')).not.toBeNull();
    r.destroy();
  });

  it('aynı metin 100 kez geldiğinde DOM textContent 1 kez yazılır (no-op guard)', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25 });
    const original = container.querySelector('#lct-subtitle-original');
    const translation = container.querySelector('#lct-subtitle-translation');
    wrapTextContent(original);
    wrapTextContent(translation);

    for (let i = 0; i < 100; i++) {
      r.update('Hello world', 'Merhaba dünya');
    }

    expect(original.getSetCount()).toBe(1);
    expect(translation.getSetCount()).toBe(1);
    expect(original.getCurrentValue()).toBe('Hello world');
    expect(translation.getCurrentValue()).toBe('Merhaba dünya');
    r.destroy();
  });

  it('farklı metin geldiğinde DOM update edilir, aynı geldiğinde atlanır', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25 });
    const original = container.querySelector('#lct-subtitle-original');
    wrapTextContent(original);

    r.update('A', 'a');
    r.update('B', 'b');
    r.update('C', 'c');
    r.update('C', 'c-baska'); // original aynı, atlanır; translation farklı, yazılır
    r.update('D', 'd');

    expect(original.getSetCount()).toBe(4); // A, B, C, D (ikinci C atlanır)
    r.destroy();
  });

  it('original ve translation bağımsız no-op olur', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25 });
    const original = container.querySelector('#lct-subtitle-original');
    const translation = container.querySelector('#lct-subtitle-translation');
    wrapTextContent(original);
    wrapTextContent(translation);

    // Original sabit, translation değişir
    r.update('X', 'a');
    r.update('X', 'b');
    r.update('X', 'c');

    expect(original.getSetCount()).toBe(1);
    expect(translation.getSetCount()).toBe(3);
    r.destroy();
  });

  it('null/undefined metin boş string olarak işlenir', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25 });
    const original = container.querySelector('#lct-subtitle-original');

    r.update(null, undefined);
    expect(original.textContent).toBe('');
    r.update('', '');
    // İkinci çağrı: aynı boş, no-op olmalı
    r.destroy();
  });

  it('applyStyle aynı value re-set olmaz (style snapshot)', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25, originalColor: '#ffffff' });
    const original = container.querySelector('#lct-subtitle-original');

    // İlk değer constructor'da uygulandı
    expect(original.style.fontSize).toBe('25px');
    // happy-dom rgb normalize etmiyor, hex korunur (browser'larda rgb()'ye dönüşür)
    expect(original.style.color.toLowerCase()).toMatch(/^(#ffffff|rgb\(255, 255, 255\))$/);

    // Aynı değerle updateStyle: değişmemeli (no throw, value korunur)
    r.updateStyle({ fontSize: 25, originalColor: '#ffffff' });
    expect(original.style.fontSize).toBe('25px');

    // Yeni değer
    r.updateStyle({ fontSize: 30 });
    expect(original.style.fontSize).toBe('30px');

    r.destroy();
  });

  it('blurOriginal class toggle eder', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25, blurOriginal: false });
    const original = container.querySelector('#lct-subtitle-original');

    expect(original.classList.contains('lct-blur')).toBe(false);
    r.updateStyle({ blurOriginal: true });
    expect(original.classList.contains('lct-blur')).toBe(true);
    r.updateStyle({ blurOriginal: false });
    expect(original.classList.contains('lct-blur')).toBe(false);

    r.destroy();
  });

  it('showOriginal false ise display none', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25, showOriginal: true });
    const original = container.querySelector('#lct-subtitle-original');

    expect(original.style.display).toBe('');
    r.updateStyle({ showOriginal: false });
    expect(original.style.display).toBe('none');
    r.updateStyle({ showOriginal: true });
    expect(original.style.display).toBe('');

    r.destroy();
  });

  it('destroy overlay\'i kaldırır', () => {
    const r = createSubtitleRenderer(video, { fontSize: 25 });
    expect(container.querySelector('#lct-subtitle-container')).not.toBeNull();
    r.destroy();
    expect(container.querySelector('#lct-subtitle-container')).toBeNull();
  });

  it('overrideContainer parametresi kullanılır (shadow DOM senaryosu)', () => {
    const ext = document.createElement('div');
    document.body.appendChild(ext);
    const r = createSubtitleRenderer(video, { fontSize: 25 }, ext);
    expect(ext.querySelector('#lct-subtitle-container')).not.toBeNull();
    expect(container.querySelector('#lct-subtitle-container')).toBeNull();
    r.destroy();
    ext.remove();
  });
});
