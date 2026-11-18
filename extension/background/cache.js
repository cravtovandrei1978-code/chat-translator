// Кэш переводов: в памяти + сохраняется в chrome.storage.local.
// Ключ = провайдер | язык | текст. Старые записи удаляются, когда их больше MAX_ENTRIES.

const STORAGE_KEY = 'translationCache';
const MAX_ENTRIES = 3000;

let map = null; // Map<key, {text, src}>
let saveTimer = null;

async function load() {
  if (map) return map;
  const data = await chrome.storage.local.get(STORAGE_KEY);
  map = new Map(Object.entries(data[STORAGE_KEY] || {}));
  return map;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ [STORAGE_KEY]: Object.fromEntries(map) });
  }, 1000);
}

export function cacheKey(provider, target, text) {
  return `${provider}|${target}|${text}`;
}

export async function cacheGet(key) {
  const m = await load();
  const v = m.get(key);
  if (v) {
    // освежаем запись (LRU)
    m.delete(key);
    m.set(key, v);
  }
  return v || null;
}

export async function cacheSet(key, value) {
  const m = await load();
  m.set(key, value);
  while (m.size > MAX_ENTRIES) m.delete(m.keys().next().value);
  scheduleSave();
}

export async function cacheClear() {
  map = new Map();
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function cacheSize() {
  return (await load()).size;
}
