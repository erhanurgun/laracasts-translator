document.addEventListener('DOMContentLoaded', async () => {
  const els = {
    enableToggle: document.getElementById('enableToggle'),
    apiKey: document.getElementById('apiKey'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    apiKeyStatus: document.getElementById('apiKeyStatus'),
    showOriginal: document.getElementById('showOriginal'),
    showTranslation: document.getElementById('showTranslation'),
    blurOriginal: document.getElementById('blurOriginal'),
    fontSize: document.getElementById('fontSize'),
    fontSizeValue: document.getElementById('fontSizeValue'),
    originalColor: document.getElementById('originalColor'),
    translationColor: document.getElementById('translationColor'),
    bgOpacity: document.getElementById('bgOpacity'),
    bgOpacityValue: document.getElementById('bgOpacityValue'),
    uiLanguage: document.getElementById('uiLanguage'),
    targetLanguage: document.getElementById('targetLanguage'),
    openaiModel: document.getElementById('openaiModel'),
    refreshModels: document.getElementById('refreshModels'),
    modelStatus: document.getElementById('modelStatus'),
    cacheStats: document.getElementById('cacheStats'),
    clearCache: document.getElementById('clearCache'),
    resetDefaults: document.getElementById('resetDefaults')
  };

  const Languages = self.LCTLanguages;
  const I18N = self.LCT_I18N;
  const C = self.LCTConstants;

  let currentUiLang = 'tr';
  // Custom dropdown instance'ları (lib/custom-select.js); populate sonrası refresh
  let uiCS = null;
  let targetCS = null;
  let modelCS = null;

  // Range slider'ın dolu kısmını brand rengiyle boyar (webkit track tek renk
  // olduğu için JS gradient gerekir; Firefox ::-moz-range-progress kullanır).
  function updateRangeFill(el) {
    if (!el) return;
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    const val = parseFloat(el.value);
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    // Nötr monokrom: dolu kısım gri gradient, boş kısım border-strong
    el.style.background = `linear-gradient(90deg, #717171 0%, #b5b5b5 ${pct}%, #2a2a2a ${pct}%, #2a2a2a 100%)`;
  }

  function applyI18n(lang) {
    currentUiLang = lang;
    document.documentElement.lang = lang;
    I18N.applyTo(document.body, lang);
    // Dinamik içerikleri yeniden ürettir
    refreshApiKeyStatus();
    refreshCacheStats();
  }

  function refreshApiKeyStatus() {
    const key = els.apiKey.value.trim();
    if (!key) {
      els.apiKeyStatus.textContent = I18N.t('popup.apiKey.missing', currentUiLang);
      els.apiKeyStatus.className = 'status error';
    } else if (key.startsWith('sk-')) {
      els.apiKeyStatus.textContent = I18N.t('popup.apiKey.saved', currentUiLang);
      els.apiKeyStatus.className = 'status success';
    } else {
      els.apiKeyStatus.textContent = I18N.t('popup.apiKey.invalidFormat', currentUiLang);
      els.apiKeyStatus.className = 'status error';
    }
  }

  // Ayar değerlerini UI'a yansıtır (ilk yükleme ve reset için ortak)
  function applySettingsToUI(settings) {
    els.enableToggle.checked = settings.enabled;
    els.showOriginal.checked = settings.showOriginal;
    els.showTranslation.checked = settings.showTranslation;
    els.blurOriginal.checked = !!settings.blurOriginal;
    els.fontSize.value = settings.fontSize;
    els.fontSizeValue.textContent = settings.fontSize;
    els.originalColor.value = settings.originalColor;
    els.translationColor.value = settings.translationColor;
    els.bgOpacity.value = Math.round(settings.bgOpacity * 100);
    els.bgOpacityValue.textContent = Math.round(settings.bgOpacity * 100);
    updateRangeFill(els.fontSize);
    updateRangeFill(els.bgOpacity);
    els.uiLanguage.value = settings.uiLanguage;
    els.targetLanguage.value = settings.targetLanguage;
    // apiKey'i de UI'a yansıt (loadModels'in popup açılışta sk-... görmesi için)
    if (typeof settings.apiKey === 'string') {
      els.apiKey.value = settings.apiKey;
    }
    // Custom dropdown label'larını senkronize et (reset defaults sonrası)
    if (uiCS) uiCS.refresh();
    if (targetCS) targetCS.refresh();
    // openaiModel dropdown'u modeller yüklendikten sonra doldurulur, kullanıcı seçimi
    // populateModels içinde uygulanır.
  }

  function populateUiLanguage() {
    const frag = document.createDocumentFragment();
    for (const lang of Languages.UI) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.native;
      frag.appendChild(opt);
    }
    els.uiLanguage.replaceChildren(frag);
  }

  function populateTargetLanguage() {
    const frag = document.createDocumentFragment();
    for (const lang of Languages.TARGET) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.native;
      frag.appendChild(opt);
    }
    els.targetLanguage.replaceChildren(frag);
  }

  function populateModels(models, activeModel) {
    const frag = document.createDocumentFragment();
    let activeFound = false;
    for (const model of models) {
      const opt = document.createElement('option');
      opt.value = model;
      opt.textContent = model;
      if (model === activeModel) {
        opt.selected = true;
        activeFound = true;
      }
      frag.appendChild(opt);
    }
    // Listede yoksa activeModel'i de ekle (kullanıcının kaydedilmiş seçimi kaybolmasın)
    if (!activeFound && activeModel) {
      const opt = document.createElement('option');
      opt.value = activeModel;
      opt.textContent = activeModel;
      opt.selected = true;
      frag.appendChild(opt);
    }
    els.openaiModel.replaceChildren(frag);
    if (modelCS) modelCS.refresh();
  }

  function setModelStatus(messageKey, level) {
    if (!messageKey) {
      els.modelStatus.textContent = '';
      els.modelStatus.className = 'status';
      return;
    }
    els.modelStatus.textContent = I18N.t(messageKey, currentUiLang);
    els.modelStatus.className = `status ${level || ''}`;
  }

  // Modelleri background'dan yükle. forceRefresh true ise 24h cache atlanır.
  // Hata/API erişimsizliğinde fallback statik liste gösterilir.
  async function loadModels(forceRefresh = false) {
    const activeModel = (await Storage.getSettings()).openaiModel;
    const apiKey = els.apiKey.value.trim();

    if (!apiKey || !apiKey.startsWith('sk-')) {
      populateModels(C.OPENAI_MODELS_FALLBACK, activeModel);
      setModelStatus('popup.model.needsKey', 'error');
      return;
    }

    if (forceRefresh) {
      setModelStatus('popup.model.loading', '');
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODELS',
        forceRefresh: !!forceRefresh
      });

      if (!response || !response.success) {
        populateModels(C.OPENAI_MODELS_FALLBACK, activeModel);
        const msgKey = response && response.needsKey ? 'popup.model.needsKey' : 'popup.model.error';
        setModelStatus(msgKey, 'error');
        return;
      }

      populateModels(response.models, activeModel);
      if (response.fromFallback) {
        setModelStatus('popup.model.error', 'error');
      } else {
        setModelStatus(null);
      }
    } catch (err) {
      console.error('LCT-Popup: loadModels hata:', err);
      populateModels(C.OPENAI_MODELS_FALLBACK, activeModel);
      setModelStatus('popup.model.error', 'error');
    }
  }

  // Ayarları yükle
  const settings = await Storage.getSettings();
  populateUiLanguage();
  populateTargetLanguage();
  applySettingsToUI(settings); // apiKey burada UI'a yazılır
  applyI18n(settings.uiLanguage); // i18n + refreshApiKeyStatus (apiKey set olduğu için doğru gösterilir)
  await loadModels(false); // apiKey görünür, kayıtlıysa fetch tetikler

  // Native select'leri custom dropdown'a çevir (brand scrollbar + option stili).
  // populate + value set sonrası oluşturulur ki ilk label doğru olsun.
  if (typeof self.createCustomSelect === 'function') {
    uiCS = self.createCustomSelect(els.uiLanguage, { maxPanelHeight: 160 });
    targetCS = self.createCustomSelect(els.targetLanguage, { maxPanelHeight: 260 });
    modelCS = self.createCustomSelect(els.openaiModel, { maxPanelHeight: 260 });
  }

  // API key göster/gizle
  els.toggleApiKey.addEventListener('click', () => {
    const isPassword = els.apiKey.type === 'password';
    els.apiKey.type = isPassword ? 'text' : 'password';
  });

  // API key kaydetme (debounced)
  let apiKeyTimer;
  els.apiKey.addEventListener('input', () => {
    clearTimeout(apiKeyTimer);
    apiKeyTimer = setTimeout(async () => {
      const key = els.apiKey.value.trim();

      if (key && !key.startsWith('sk-')) {
        els.apiKeyStatus.textContent = I18N.t('popup.apiKey.invalidFormat', currentUiLang);
        els.apiKeyStatus.className = 'status error';
        return;
      }

      await Storage.setApiKey(key);
      if (key) {
        els.apiKeyStatus.textContent = I18N.t('popup.apiKey.savedActive', currentUiLang);
        els.apiKeyStatus.className = 'status success';
        // API key girilince modelleri yeniden yükle (FAZ 4 canlı fetch)
        loadModels(false);
      } else {
        els.apiKeyStatus.textContent = I18N.t('popup.apiKey.missing', currentUiLang);
        els.apiKeyStatus.className = 'status error';
      }
      broadcastSettingsChange();
    }, 500);
  });

  // Toggle'lar ve ayar değişiklikleri
  els.enableToggle.addEventListener('change', async () => {
    if (!els.enableToggle.checked) {
      try {
        await chrome.management.setEnabled(chrome.runtime.id, false);
      } catch (e) {
        console.error('Eklenti self-disable başarısız:', e);
        await Storage.saveSetting('enabled', false);
        broadcastSettingsChange();
      }
      return;
    }
    await Storage.saveSetting('enabled', true);
    broadcastSettingsChange();
  });

  els.showOriginal.addEventListener('change', () => {
    Storage.saveSetting('showOriginal', els.showOriginal.checked);
    broadcastSettingsChange();
  });

  els.showTranslation.addEventListener('change', () => {
    Storage.saveSetting('showTranslation', els.showTranslation.checked);
    broadcastSettingsChange();
  });

  els.blurOriginal.addEventListener('change', () => {
    Storage.saveSetting('blurOriginal', els.blurOriginal.checked);
    broadcastSettingsChange();
  });

  let fontSizeTimer;
  els.fontSize.addEventListener('input', () => {
    els.fontSizeValue.textContent = els.fontSize.value;
    updateRangeFill(els.fontSize);
    clearTimeout(fontSizeTimer);
    fontSizeTimer = setTimeout(() => {
      Storage.saveSetting('fontSize', parseInt(els.fontSize.value));
      broadcastSettingsChange();
    }, 300);
  });

  els.originalColor.addEventListener('change', () => {
    Storage.saveSetting('originalColor', els.originalColor.value);
    broadcastSettingsChange();
  });

  els.translationColor.addEventListener('change', () => {
    Storage.saveSetting('translationColor', els.translationColor.value);
    broadcastSettingsChange();
  });

  let bgOpacityTimer;
  els.bgOpacity.addEventListener('input', () => {
    els.bgOpacityValue.textContent = els.bgOpacity.value;
    updateRangeFill(els.bgOpacity);
    clearTimeout(bgOpacityTimer);
    bgOpacityTimer = setTimeout(() => {
      Storage.saveSetting('bgOpacity', parseInt(els.bgOpacity.value) / 100);
      broadcastSettingsChange();
    }, 300);
  });

  // Dil + model değişiklikleri
  els.uiLanguage.addEventListener('change', async () => {
    const code = els.uiLanguage.value;
    if (!Languages.isSupportedUi(code)) return;
    await Storage.saveSetting('uiLanguage', code);
    applyI18n(code);
    broadcastSettingsChange();
  });

  els.targetLanguage.addEventListener('change', async () => {
    const code = els.targetLanguage.value;
    if (!Languages.isSupportedTarget(code)) return;
    await Storage.saveSetting('targetLanguage', code);
    broadcastSettingsChange();
  });

  els.openaiModel.addEventListener('change', async () => {
    const model = els.openaiModel.value;
    if (!model) return;
    await Storage.saveSetting('openaiModel', model);
    broadcastSettingsChange();
  });

  els.refreshModels.addEventListener('click', async () => {
    setModelStatus('popup.model.loading', '');
    await loadModels(true);
  });

  // Varsayılana sıfırla (API key hariç)
  els.resetDefaults.addEventListener('click', async () => {
    const { apiKey: _ignored, ...defaults } = Storage.defaults;
    await Storage.saveSettings(defaults);
    applySettingsToUI(defaults);
    applyI18n(defaults.uiLanguage);
    await loadModels(false);
    broadcastSettingsChange();
  });

  // Cache
  await refreshCacheStats();

  els.clearCache.addEventListener('click', async () => {
    await Storage.clearCache();
    await refreshCacheStats();
  });

  async function refreshCacheStats() {
    const stats = await Storage.getCacheStats();
    els.cacheStats.textContent = I18N.t('popup.cache.stats', currentUiLang, {
      count: stats.count,
      sizeKB: stats.sizeKB
    });
  }

  function broadcastSettingsChange() {
    chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' }).catch(() => {});
  }
});
