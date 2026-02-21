document.addEventListener('DOMContentLoaded', async () => {
  const els = {
    enableToggle: document.getElementById('enableToggle'),
    apiKey: document.getElementById('apiKey'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    apiKeyStatus: document.getElementById('apiKeyStatus'),
    showOriginal: document.getElementById('showOriginal'),
    showTranslation: document.getElementById('showTranslation'),
    fontSize: document.getElementById('fontSize'),
    fontSizeValue: document.getElementById('fontSizeValue'),
    originalColor: document.getElementById('originalColor'),
    translationColor: document.getElementById('translationColor'),
    bgOpacity: document.getElementById('bgOpacity'),
    bgOpacityValue: document.getElementById('bgOpacityValue'),
    cacheStats: document.getElementById('cacheStats'),
    clearCache: document.getElementById('clearCache'),
    resetDefaults: document.getElementById('resetDefaults')
  };

  // Ayar değerlerini UI'a yansıtır (ilk yükleme ve reset için ortak)
  function applySettingsToUI(settings) {
    els.enableToggle.checked = settings.enabled;
    els.showOriginal.checked = settings.showOriginal;
    els.showTranslation.checked = settings.showTranslation;
    els.fontSize.value = settings.fontSize;
    els.fontSizeValue.textContent = settings.fontSize;
    els.originalColor.value = settings.originalColor;
    els.translationColor.value = settings.translationColor;
    els.bgOpacity.value = Math.round(settings.bgOpacity * 100);
    els.bgOpacityValue.textContent = Math.round(settings.bgOpacity * 100);
  }

  // Ayarları yükle
  const settings = await Storage.getSettings();
  applySettingsToUI(settings);
  els.apiKey.value = settings.apiKey;

  if (settings.apiKey) {
    els.apiKeyStatus.textContent = 'API key kayıtlı';
    els.apiKeyStatus.className = 'status success';
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

      // Format doğrulama
      if (key && !key.startsWith('sk-')) {
        els.apiKeyStatus.textContent = 'Geçersiz format - OpenAI key "sk-" ile başlamalı';
        els.apiKeyStatus.className = 'status error';
        return;
      }

      await Storage.setApiKey(key);
      if (key) {
        els.apiKeyStatus.textContent = 'API key kaydedildi. Aktif videolar için çeviri başlatılıyor...';
        els.apiKeyStatus.className = 'status success';
      } else {
        els.apiKeyStatus.textContent = 'API key gerekli';
        els.apiKeyStatus.className = 'status error';
      }
      broadcastSettingsChange();
    }, 500);
  });

  // Toggle'lar ve ayar değişiklikleri
  els.enableToggle.addEventListener('change', () => {
    Storage.saveSetting('enabled', els.enableToggle.checked);
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

  let fontSizeTimer;
  els.fontSize.addEventListener('input', () => {
    els.fontSizeValue.textContent = els.fontSize.value;
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
    clearTimeout(bgOpacityTimer);
    bgOpacityTimer = setTimeout(() => {
      Storage.saveSetting('bgOpacity', parseInt(els.bgOpacity.value) / 100);
      broadcastSettingsChange();
    }, 300);
  });

  // Varsayılana sıfırla (API key hariç)
  els.resetDefaults.addEventListener('click', async () => {
    const { apiKey: _ignored, ...defaults } = Storage.defaults;
    await Storage.saveSettings(defaults);
    applySettingsToUI(defaults);
    broadcastSettingsChange();
  });

  // Cache
  await updateCacheStats();

  els.clearCache.addEventListener('click', async () => {
    await Storage.clearCache();
    await updateCacheStats();
  });

  async function updateCacheStats() {
    const stats = await Storage.getCacheStats();
    els.cacheStats.textContent = `${stats.count} video önbellekte (${stats.sizeKB} KB)`;
  }

  function broadcastSettingsChange() {
    chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED' }).catch(() => {});
  }
});
