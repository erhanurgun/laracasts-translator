/**
 * Background Service Worker
 * - OpenAI API çağrıları
 * - Çeviri cache yönetimi
 * - Mesaj yönlendirme
 */

// --- Storage helpers (service worker'da lib/storage.js yüklenemez) ---

const StorageBg = {
  async getApiKey() {
    const { _lct_apiKey } = await chrome.storage.local.get({ _lct_apiKey: '' });
    if (_lct_apiKey) return _lct_apiKey;
    // Fallback: migrasyon henüz tamamlanmamış olabilir
    const { apiKey } = await chrome.storage.sync.get({ apiKey: '' });
    return apiKey;
  },

  async getSettings() {
    const syncDefaults = {
      enabled: true,
      showOriginal: true,
      showTranslation: true,
      fontSize: 25,
      originalColor: '#ffffff',
      translationColor: '#ffd700',
      bgOpacity: 0.75
    };
    const settings = await chrome.storage.sync.get(syncDefaults);
    // apiKey local'den gelir
    settings.apiKey = await this.getApiKey();
    return settings;
  },

  _cacheKey(videoId) {
    return `translation_${videoId}_tr`;
  },

  async getCachedTranslation(videoId) {
    const key = this._cacheKey(videoId);
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  },

  async setCachedTranslation(videoId, cues, fingerprint) {
    const key = this._cacheKey(videoId);
    const entry = { cues, fingerprint, timestamp: Date.now() };
    try {
      await chrome.storage.local.set({ [key]: entry });
    } catch (e) {
      if (e.message && e.message.includes('QUOTA_BYTES')) {
        await this._evictOldest();
        await chrome.storage.local.set({ [key]: entry });
      }
    }
  },

  async _evictOldest() {
    const all = await chrome.storage.local.get(null);
    const cacheEntries = Object.entries(all)
      .filter(([k]) => k.startsWith('translation_'))
      .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
    const toRemove = cacheEntries.slice(0, Math.max(1, Math.floor(cacheEntries.length / 4)));
    await chrome.storage.local.remove(toRemove.map(([k]) => k));
  }
};

// --- Cache Fingerprint ---

function createFingerprint(cues) {
  const allText = cues.map(c => c.text).join('|');
  let hash = 0;
  for (let i = 0; i < allText.length; i++) {
    hash = ((hash << 5) - hash + allText.charCodeAt(i)) | 0;
  }
  return `v2:${cues.length}:${hash}`;
}

// --- OpenAI Çeviri ---

const SYSTEM_PROMPT = `You are a professional subtitle translator for programming education videos.
Translate the following English subtitles into Turkish.

Rules:
1. Return translations in the exact same numbered format.
2. Keep technical terms in English: Laravel, Vue, React, controller, middleware, artisan, npm, composer, migration, eloquent, blade, livewire, route, model, component, prop, state, hook, API, endpoint, database, query, schema, factory, seeder, test, deploy, container, Docker, Git, commit, branch, merge, pull request, etc.
3. Keep translations concise - subtitles must be readable at normal speed.
4. Maintain conversational/tutorial tone.
5. Translate filler words naturally (um→şey, okay→tamam, right→değil mi, so→yani, actually→aslında, basically→temelde).
6. Do NOT add explanations or notes.
7. Return ONLY the numbered translations, nothing else.
8. Format each translation on its own line as: NUMBER. TRANSLATION
9. Do not add blank lines between translations.
10. Do not include the original text, only the translation.
11. CRITICAL: You MUST output EXACTLY the same number of translations as input lines.
12. NEVER combine, skip, merge, or reorder input lines. Each numbered line MUST have its own separate numbered translation.
13. Even for very short lines like "Okay." or "So.", translate them individually with their own number.`;

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

async function translateBatch(texts, apiKey, retryCount = 0) {
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const body = {
    model: 'gpt-4o',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: numbered }
    ]
  };

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (response.status === 401) {
        throw { status: 401, message: 'Geçersiz API key' };
      }

      if (response.status === 429) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!response.ok) {
        throw { status: response.status, message: `API hatası: ${response.status}` };
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();

      // Numaralı satırları parse et (baştaki boşlukları tolere et)
      const translations = {};
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*(\d+)\.\s*(.+)/);
        if (match) {
          translations[parseInt(match[1]) - 1] = match[2].trim();
        }
      }

      // Parse başarısını kontrol et
      const matchedCount = Object.keys(translations).length;
      if (matchedCount === 0) {
        // Tam başarısızlık: hiç numara eşleşmedi, sıralı satır eşleştirme dene
        console.warn(`LCT: Numaralı parse tamamen başarısız, sıralı eşleştirme deneniyor`);
        const nonEmptyLines = lines
          .map(l => l.trim())
          .filter(l => l.length > 0)
          .map(l => l.replace(/^\s*\d+\.\s*/, ''));

        for (let i = 0; i < Math.min(texts.length, nonEmptyLines.length); i++) {
          translations[i] = nonEmptyLines[i];
        }
      }

      // Strict count validation + retry
      const finalCount = Object.keys(translations).length;
      if (finalCount !== texts.length) {
        console.warn(`LCT: Çeviri sayısı uyuşmuyor (${finalCount}/${texts.length}), retry #${retryCount}`);

        if (retryCount < 2) {
          // Batch'i yarıya böl ve ayrı ayrı çevir
          const mid = Math.ceil(texts.length / 2);
          const firstHalf = await translateBatch(texts.slice(0, mid), apiKey, retryCount + 1);
          const secondHalf = await translateBatch(texts.slice(mid), apiKey, retryCount + 1);
          return [...firstHalf, ...secondHalf];
        }
        // 2 retry sonrası: mevcut sonucu kullan (eksikler boş kalır)
        console.warn(`LCT: Retry tükendi, mevcut sonuç kullanılıyor (${finalCount}/${texts.length})`);
      }

      return texts.map((_, i) => translations[i] || '');

    } catch (e) {
      lastError = e;
      if (e.status === 401) throw e;
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('Çeviri başarısız');
}

async function translateCues(cues, videoId, onProgress) {
  const fingerprint = createFingerprint(cues);

  // Önce cache kontrol (fingerprint ile doğrula)
  const cached = await StorageBg.getCachedTranslation(videoId);
  if (cached && cached.cues && cached.cues.length === cues.length) {
    if (cached.fingerprint === fingerprint) {
      if (onProgress) onProgress({ cached: true });
      return cached.cues;
    }
    console.warn('LCT: Cache fingerprint uyuşmuyor, yeniden çeviriliyor');
  }

  const apiKey = await StorageBg.getApiKey();
  if (!apiKey) {
    throw { status: 0, message: 'API key gerekli' };
  }

  const texts = cues.map(c => c.text);
  const allTranslations = [];
  const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

  // Batch'ler halinde çevir
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    if (onProgress) onProgress({ current: batchIndex, total: totalBatches });

    const batch = texts.slice(i, i + BATCH_SIZE);
    const translated = await translateBatch(batch, apiKey);
    allTranslations.push(...translated);
  }

  // Cue'lara çevirileri ekle
  const result = cues.map((cue, i) => ({
    ...cue,
    translation: allTranslations[i] || ''
  }));

  // Cache'e kaydet (fingerprint ile)
  await StorageBg.setCachedTranslation(videoId, result, fingerprint);

  return result;
}

// --- VTT Fetch (CORS bypass) ---

async function fetchVTT(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`VTT fetch hatası: ${response.status}`);
  return response.text();
}

// --- Laracasts tab'a durum bildir ---

function sendStatusToTab(tabId, status, error) {
  chrome.tabs.sendMessage(tabId, {
    type: 'TRANSLATION_STATUS', status, error
  }).catch(() => {});
}

// --- Port-based Çeviri (ilerleme destekli) ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'translate') return;

  // Sender doğrulama
  const senderUrl = port.sender?.url || '';
  if (!senderUrl.includes('player.vimeo.com')) {
    port.disconnect();
    return;
  }

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'TRANSLATE_CUES') {
      const tabId = port.sender?.tab?.id;
      let wasCached = false;

      // Laracasts'e durum bildir
      if (tabId) sendStatusToTab(tabId, 'translating');

      try {
        const result = await translateCues(msg.cues, msg.videoId, (progress) => {
          if (progress.cached) wasCached = true;
          port.postMessage({ type: 'PROGRESS', ...progress });
        });
        port.postMessage({ type: 'COMPLETE', cues: result });
        if (tabId) sendStatusToTab(tabId, wasCached ? 'cached' : 'done');
      } catch (err) {
        port.postMessage({ type: 'ERROR', error: err.message || 'Çeviri hatası' });
        if (tabId) sendStatusToTab(tabId, 'error', err.message);
      }
    }
  });
});

// --- Mesaj Dinleyicisi ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATE_CUES') {
    // Sender doğrulama
    const senderUrl = sender?.url || '';
    if (!senderUrl.includes('player.vimeo.com')) {
      sendResponse({ success: false, error: 'Yetkisiz kaynak' });
      return true;
    }

    translateCues(message.cues, message.videoId)
      .then(result => sendResponse({ success: true, cues: result }))
      .catch(err => sendResponse({ success: false, error: err.message || 'Çeviri hatası' }));
    return true; // async response
  }

  if (message.type === 'FETCH_VTT') {
    fetchVTT(message.url)
      .then(text => sendResponse({ success: true, text }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    StorageBg.getSettings()
      .then(settings => {
        // Content script'lere apiKey gönderme — sadece varlık bilgisi yeter
        const { apiKey, ...safeSettings } = settings;
        safeSettings.hasApiKey = !!apiKey;
        sendResponse({ success: true, settings: safeSettings });
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'SETTINGS_CHANGED') {
    // Tüm tab'lara ilet (yedek mekanizma, asıl dinleme storage.onChanged ile)
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED' }).catch(() => {});
      }
    });
    return true;
  }
});

// --- API Key Migrasyon (sync → local) ---

async function migrateApiKey() {
  const { apiKey } = await chrome.storage.sync.get({ apiKey: '' });
  if (apiKey) {
    await chrome.storage.local.set({ _lct_apiKey: apiKey });
    await chrome.storage.sync.remove('apiKey');
    console.log('LCT: API key local storage\'a taşındı');
  }
}

migrateApiKey();

console.log('Laracasts Translator: Background service worker başlatıldı');
