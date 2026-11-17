// Фоновый скрипт: принимает запросы на перевод от страниц, ходит в API, кэширует.
import { getSettings, saveSettings } from './settings.js';
import { translateBatch } from './providers.js';
import { cacheKey, cacheGet, cacheSet, cacheClear, cacheSize } from './cache.js';

async function translate({ texts, target, source }) {
  const settings = await getSettings();
  const results = new Array(texts.length);
  const missing = [];

  for (let i = 0; i < texts.length; i++) {
    const hit = await cacheGet(cacheKey(settings.provider, target, texts[i]));
    if (hit) results[i] = { ...hit, cached: true };
    else missing.push(i);
  }

  if (missing.length) {
    const fresh = await translateBatch(
      settings,
      missing.map((i) => texts[i]),
      target,
      source
    );
    missing.forEach((idx, j) => {
      results[idx] = fresh[j];
      cacheSet(cacheKey(settings.provider, target, texts[idx]), fresh[j]);
    });
  }
  return results;
}

const handlers = {
  translate,
  getSettings: () => getSettings(),
  saveSettings: ({ patch }) => saveSettings(patch),
  clearCache: () => cacheClear(),
  cacheSize: () => cacheSize(),
  openOptions: () => chrome.runtime.openOptionsPage(),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const fn = handlers[msg && msg.type];
  if (!fn) return false;
  Promise.resolve(fn(msg))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err), code: err.code }));
  return true; // ответ придёт асинхронно
});

// При первой установке сразу открываем настройки, чтобы вставить ключ.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
