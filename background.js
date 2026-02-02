/**
 * Background Service Worker
 * - OpenAI API çağrıları
 * - Çeviri cache yönetimi
 * - Mesaj yönlendirme
 */

// --- Storage helpers (service worker'da lib/storage.js yüklenemez) ---

const StorageBg = {
  async getApiKey() {
    const { apiKey } = await chrome.storage.sync.get({ apiKey: '' });
    return apiKey;
  },

  async getSettings() {
    const defaults = {
      apiKey: '',
      enabled: true,
      showOriginal: true,
      showTranslation: true,
      fontSize: 16,
      originalColor: '#ffffff',
      translationColor: '#ffd700',
      bgOpacity: 0.75
    };
    return chrome.storage.sync.get(defaults);
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
  const sample = cues.slice(0, 3).map(c => c.text).join('|');
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash + sample.charCodeAt(i)) | 0;
  }
  return `${cues.length}:${hash}`;
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
10. Do not include the original text, only the translation.`;

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

async function translateBatch(texts, apiKey) {
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

      // Validasyon
      const finalCount = Object.keys(translations).length;
      if (finalCount !== texts.length) {
        console.warn(`LCT: Çeviri sayısı uyuşmuyor (${finalCount}/${texts.length}), eksikler boş olacak`);
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

async function translateCues(cues, videoId) {
  const fingerprint = createFingerprint(cues);

  // Önce cache kontrol (fingerprint ile doğrula)
  const cached = await StorageBg.getCachedTranslation(videoId);
  if (cached && cached.cues && cached.cues.length === cues.length) {
    if (cached.fingerprint === fingerprint) {
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

  // Batch'ler halinde çevir
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
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

// --- Mesaj Dinleyicisi ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATE_CUES') {
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
      .then(settings => sendResponse({ success: true, settings }))
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

console.log('Laracasts Translator: Background service worker başlatıldı');
