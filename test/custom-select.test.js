const { createCustomSelect } = require('../lib/custom-select.js');

function makeSelect(opts, selectedValue) {
  const sel = document.createElement('select');
  for (const o of opts) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  }
  document.body.appendChild(sel);
  if (selectedValue !== undefined) sel.value = selectedValue;
  return sel;
}

describe('createCustomSelect', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('null veya select olmayan element için null', () => {
    expect(createCustomSelect(null)).toBeNull();
    expect(createCustomSelect(document.createElement('div'))).toBeNull();
  });

  it('wrapper + trigger + panel oluşturur, native select gizlenir', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], 'a');
    createCustomSelect(sel);
    const wrapper = document.querySelector('.lct-cs');
    expect(wrapper).not.toBeNull();
    expect(wrapper.querySelector('.lct-cs-trigger')).not.toBeNull();
    expect(wrapper.querySelector('.lct-cs-panel')).not.toBeNull();
    expect(sel.classList.contains('lct-cs-native')).toBe(true);
    expect(sel.getAttribute('aria-hidden')).toBe('true');
  });

  it('trigger label seçili option metnini gösterir', () => {
    const sel = makeSelect([{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }], 'b');
    createCustomSelect(sel);
    expect(document.querySelector('.lct-cs-label').textContent).toBe('Banana');
  });

  it('panel her option için bir item üretir', () => {
    const sel = makeSelect([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' }
    ], 'a');
    createCustomSelect(sel);
    expect(document.querySelectorAll('.lct-cs-option').length).toBe(3);
  });

  it('trigger click panel açar, tekrar tıklama kapatır', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }], 'a');
    createCustomSelect(sel);
    const wrapper = document.querySelector('.lct-cs');
    const trigger = wrapper.querySelector('.lct-cs-trigger');
    expect(wrapper.classList.contains('open')).toBe(false);
    trigger.click();
    expect(wrapper.classList.contains('open')).toBe(true);
    trigger.click();
    expect(wrapper.classList.contains('open')).toBe(false);
  });

  it('option click value + change event + panel kapanır + label güncellenir', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], 'a');
    createCustomSelect(sel);
    let changed = false;
    sel.addEventListener('change', () => { changed = true; });
    const wrapper = document.querySelector('.lct-cs');
    wrapper.querySelector('.lct-cs-trigger').click();
    const opts = wrapper.querySelectorAll('.lct-cs-option');
    opts[1].click();
    expect(sel.value).toBe('b');
    expect(changed).toBe(true);
    expect(wrapper.classList.contains('open')).toBe(false);
    expect(document.querySelector('.lct-cs-label').textContent).toBe('B');
  });

  it('refresh() option listesini ve label\'ı yeniden okur', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }], 'a');
    const cs = createCustomSelect(sel);
    const opt = document.createElement('option');
    opt.value = 'c';
    opt.textContent = 'Cherry';
    sel.appendChild(opt);
    sel.value = 'c';
    cs.refresh();
    expect(document.querySelector('.lct-cs-label').textContent).toBe('Cherry');
    expect(document.querySelectorAll('.lct-cs-option').length).toBe(2);
  });

  it('dışarı tıklama paneli kapatır', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }], 'a');
    createCustomSelect(sel);
    const wrapper = document.querySelector('.lct-cs');
    wrapper.querySelector('.lct-cs-trigger').click();
    expect(wrapper.classList.contains('open')).toBe(true);
    document.body.click();
    expect(wrapper.classList.contains('open')).toBe(false);
  });

  it('seçili option .selected class alır', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], 'b');
    createCustomSelect(sel);
    const items = document.querySelectorAll('.lct-cs-option');
    expect(items[0].classList.contains('selected')).toBe(false);
    expect(items[1].classList.contains('selected')).toBe(true);
  });

  it('destroy() native select\'i geri koyar, wrapper kaldırılır', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }], 'a');
    const cs = createCustomSelect(sel);
    expect(document.querySelector('.lct-cs')).not.toBeNull();
    cs.destroy();
    expect(document.querySelector('.lct-cs')).toBeNull();
    expect(sel.classList.contains('lct-cs-native')).toBe(false);
    expect(sel.getAttribute('aria-hidden')).toBeNull();
  });

  it('aynı select için ikinci çağrı aynı instance döner (idempotent)', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }], 'a');
    const cs1 = createCustomSelect(sel);
    const cs2 = createCustomSelect(sel);
    expect(cs1).toBe(cs2);
  });

  it('ArrowDown klavye ile sonraki option seçilir', () => {
    const sel = makeSelect([{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], 'a');
    createCustomSelect(sel);
    let changed = false;
    sel.addEventListener('change', () => { changed = true; });
    const trigger = document.querySelector('.lct-cs-trigger');
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    trigger.dispatchEvent(ev);
    expect(sel.value).toBe('b');
    expect(changed).toBe(true);
  });
});
