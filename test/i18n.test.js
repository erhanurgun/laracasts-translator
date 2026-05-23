const { LCT_I18N, LCT_I18N_BUNDLES } = require('../lib/i18n.js');

describe('LCT_I18N bundles', () => {
  it('tr ve en bundle frozen olmalı', () => {
    expect(Object.isFrozen(LCT_I18N_BUNDLES)).toBe(true);
    expect(Object.isFrozen(LCT_I18N_BUNDLES.tr)).toBe(true);
    expect(Object.isFrozen(LCT_I18N_BUNDLES.en)).toBe(true);
  });

  it('iki bundle aynı anahtar setine sahip olmalı', () => {
    const missing = LCT_I18N.findMissingKeys();
    expect(missing.missingInEn).toEqual([]);
    expect(missing.missingInTr).toEqual([]);
  });

  it('en az 25 anahtar içermeli', () => {
    expect(Object.keys(LCT_I18N_BUNDLES.tr).length).toBeGreaterThanOrEqual(25);
  });
});

describe('LCT_I18N.t()', () => {
  it('tr ile Türkçe metin döndürür', () => {
    expect(LCT_I18N.t('popup.apiKey.label', 'tr')).toBe('OpenAI API Key');
    expect(LCT_I18N.t('popup.subtitle.title', 'tr')).toBe('Altyazı Ayarları');
  });

  it('en ile İngilizce metin döndürür', () => {
    expect(LCT_I18N.t('popup.subtitle.title', 'en')).toBe('Subtitle Settings');
    expect(LCT_I18N.t('popup.subtitle.showOriginal', 'en')).toBe('Show original subtitle');
  });

  it('bilinmeyen dil için tr fallback uygulanır', () => {
    expect(LCT_I18N.t('popup.subtitle.title', 'xx')).toBe('Altyazı Ayarları');
    expect(LCT_I18N.t('popup.subtitle.title', null)).toBe('Altyazı Ayarları');
    expect(LCT_I18N.t('popup.subtitle.title', undefined)).toBe('Altyazı Ayarları');
  });

  it('eksik anahtar için key kendisi döner', () => {
    expect(LCT_I18N.t('popup.nonexistent.key', 'tr')).toBe('popup.nonexistent.key');
    expect(LCT_I18N.t('popup.nonexistent.key', 'en')).toBe('popup.nonexistent.key');
  });

  it('değişken substitution çalışır ({count}, {sizeKB})', () => {
    expect(LCT_I18N.t('popup.cache.stats', 'tr', { count: 3, sizeKB: 42 }))
      .toBe('3 video önbellekte (42 KB)');
    expect(LCT_I18N.t('popup.cache.stats', 'en', { count: 7, sizeKB: 128 }))
      .toBe('7 videos cached (128 KB)');
  });

  it('vars verilmediğinde literal döner', () => {
    expect(LCT_I18N.t('popup.cache.stats', 'tr'))
      .toBe('{count} video önbellekte ({sizeKB} KB)');
  });
});

describe('LCT_I18N.applyTo()', () => {
  function appendChild(parent, tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'text') {
          el.textContent = v;
        } else if (k.startsWith('data-')) {
          el.setAttribute(k, v);
        } else {
          el[k] = v;
        }
      }
    }
    parent.appendChild(el);
    return el;
  }

  function createDom() {
    const root = document.createElement('div');
    appendChild(root, 'h1', { 'data-i18n': 'popup.title', text: 'eski' });
    appendChild(root, 'label', { 'data-i18n': 'popup.apiKey.label', text: 'eski' });
    appendChild(root, 'button', { 'data-i18n-title': 'popup.apiKey.toggleTitle', title: 'eski', text: 'x' });
    appendChild(root, 'input', { type: 'text', 'data-i18n-placeholder': 'popup.apiKey.placeholder', placeholder: 'eski' });
    appendChild(root, 'span', { 'data-i18n-tooltip': 'popup.subtitle.blurOriginalTooltip', text: 'y' });
    return root;
  }

  it('tr ile DOM içeriğini günceller', () => {
    const root = createDom();
    LCT_I18N.applyTo(root, 'tr');
    expect(root.querySelector('h1').textContent).toBe('Laracasts Translator');
    expect(root.querySelector('label').textContent).toBe('OpenAI API Key');
    expect(root.querySelector('button').title).toBe('Göster/Gizle');
    expect(root.querySelector('input').placeholder).toBe('sk-...');
    expect(root.querySelector('span').dataset.tooltip).toMatch(/^Öğrenme modu/);
  });

  it('en ile DOM içeriğini günceller', () => {
    const root = createDom();
    LCT_I18N.applyTo(root, 'en');
    expect(root.querySelector('label').textContent).toBe('OpenAI API Key');
    expect(root.querySelector('button').title).toBe('Show/Hide');
    expect(root.querySelector('span').dataset.tooltip).toMatch(/^Learning mode/);
  });

  it('bilinmeyen dil tr fallback', () => {
    const root = createDom();
    LCT_I18N.applyTo(root, 'xx');
    expect(root.querySelector('h1').textContent).toBe('Laracasts Translator');
    expect(root.querySelector('button').title).toBe('Göster/Gizle');
  });

  it('root null/undefined olduğunda hata atmaz', () => {
    expect(() => LCT_I18N.applyTo(null, 'tr')).not.toThrow();
    expect(() => LCT_I18N.applyTo(undefined, 'tr')).not.toThrow();
  });
});
