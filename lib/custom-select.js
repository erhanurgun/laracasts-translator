/**
 * Native <select> elementini custom dropdown UI ile zenginleştirir.
 * Native select gizlenir ama DOM'da state kaynağı olarak kalır; custom UI
 * tıklamada select.value'yu set edip 'change' event dispatch eder, böylece
 * mevcut change listener'ları aynen çalışır.
 *
 * Sebep: Chrome'da native <select> açılan option listesi OS-rendered'dır,
 * scrollbar ve option stilleri CSS ile özelleştirilemez. Custom panel ile
 * tam kontrol (brand scrollbar, hover, seçili vurgu) sağlanır.
 *
 * Kullanım:
 *   const cs = createCustomSelect(selectEl);
 *   // <select> option'ları sonradan değişirse:
 *   cs.refresh();
 *
 * Chrome Extension: global `self.createCustomSelect`.
 * Node (test): `require('lib/custom-select.js').createCustomSelect`.
 */
function createCustomSelect(selectEl, options) {
  if (!selectEl || selectEl.tagName !== 'SELECT') return null;
  if (selectEl._lctCustomSelect) return selectEl._lctCustomSelect;

  const opts = options || {};
  const maxPanelHeight = typeof opts.maxPanelHeight === 'number' ? opts.maxPanelHeight : 240;

  const wrapper = document.createElement('div');
  wrapper.className = 'lct-cs';
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  selectEl.classList.add('lct-cs-native');
  selectEl.setAttribute('aria-hidden', 'true');
  selectEl.tabIndex = -1;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lct-cs-trigger';

  const triggerLabel = document.createElement('span');
  triggerLabel.className = 'lct-cs-label';
  trigger.appendChild(triggerLabel);

  const triggerArrow = document.createElement('span');
  triggerArrow.className = 'lct-cs-arrow';
  trigger.appendChild(triggerArrow);

  wrapper.appendChild(trigger);

  const panel = document.createElement('div');
  panel.className = 'lct-cs-panel';
  panel.style.maxHeight = maxPanelHeight + 'px';
  wrapper.appendChild(panel);

  let isOpen = false;

  function syncLabel() {
    const sel = selectEl.options[selectEl.selectedIndex];
    triggerLabel.textContent = sel ? sel.textContent : '';
  }

  function markSelected() {
    const items = panel.querySelectorAll('.lct-cs-option');
    for (const it of items) {
      it.classList.toggle('selected', it.dataset.value === selectEl.value);
    }
  }

  function buildPanel() {
    panel.replaceChildren();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < selectEl.options.length; i++) {
      const o = selectEl.options[i];
      const item = document.createElement('div');
      item.className = 'lct-cs-option';
      item.setAttribute('role', 'option');
      item.textContent = o.textContent;
      item.dataset.value = o.value;
      if (i === selectEl.selectedIndex) item.classList.add('selected');
      item.addEventListener('click', () => {
        selectEl.value = o.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        syncLabel();
        markSelected();
        closePanel();
      });
      frag.appendChild(item);
    }
    panel.appendChild(frag);
  }

  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    wrapper.classList.add('open');
    markSelected();
    const sel = panel.querySelector('.lct-cs-option.selected');
    if (sel && typeof sel.scrollIntoView === 'function') {
      sel.scrollIntoView({ block: 'nearest' });
    }
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    wrapper.classList.remove('open');
  }

  function togglePanel() {
    if (isOpen) closePanel(); else openPanel();
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePanel();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePanel();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const optsList = selectEl.options;
      let idx = selectEl.selectedIndex;
      idx = e.key === 'ArrowDown' ? Math.min(optsList.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (idx !== selectEl.selectedIndex) {
        selectEl.selectedIndex = idx;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        syncLabel();
        markSelected();
      }
    }
  });

  const outsideClickHandler = (e) => {
    if (!wrapper.contains(e.target)) closePanel();
  };
  document.addEventListener('click', outsideClickHandler);

  buildPanel();
  syncLabel();

  const api = {
    refresh() { buildPanel(); syncLabel(); },
    close() { closePanel(); },
    isOpen() { return isOpen; },
    destroy() {
      document.removeEventListener('click', outsideClickHandler);
      selectEl.classList.remove('lct-cs-native');
      selectEl.removeAttribute('aria-hidden');
      selectEl.tabIndex = 0;
      if (wrapper.parentNode) {
        wrapper.parentNode.insertBefore(selectEl, wrapper);
        wrapper.remove();
      }
      delete selectEl._lctCustomSelect;
    }
  };

  selectEl._lctCustomSelect = api;
  return api;
}

if (typeof self !== 'undefined') {
  self.createCustomSelect = createCustomSelect;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCustomSelect };
}
