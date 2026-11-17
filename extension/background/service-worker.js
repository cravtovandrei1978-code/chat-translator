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

// ---------- Универсальный режим: перевод на любом сайте, который человек включил сам ----------
const DYN_JS = [
  'content/namespace.js',
  'content/adapters/generic.js',
  'content/adapters/registry.js',
  'content/translit.js',
  'content/ui.js',
  'content/main.js',
];
const API_HOSTS = /deepl\.com|googleapis\.com|anthropic\.com/;
const scriptId = (pattern) => 'ct-' + pattern.replace(/[^a-z0-9]+/gi, '-');

async function enableSite(pattern) {
  if (API_HOSTS.test(pattern)) return;
  const id = scriptId(pattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (!existing.length) {
    await chrome.scripting.registerContentScripts([
      { id, matches: [pattern], js: DYN_JS, css: ['content/ui.css'], runAt: 'document_idle' },
    ]);
  }
  const s = await getSettings();
  if (!s.sites.includes(pattern)) await saveSettings({ sites: [...s.sites, pattern] });
  // сразу запускаем на уже открытых вкладках этого сайта
  const tabs = await chrome.tabs.query({ url: pattern });
  for (const t of tabs) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: t.id }, files: ['content/ui.css'] });
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: DYN_JS });
    } catch (_) {}
  }
}

async function disableSite(pattern) {
  const id = scriptId(pattern);
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  } catch (_) {}
  const s = await getSettings();
  await saveSettings({ sites: s.sites.filter((p) => p !== pattern) });
}

chrome.permissions.onAdded.addListener(({ origins = [] }) => origins.forEach(enableSite));
chrome.permissions.onRemoved.addListener(({ origins = [] }) => origins.forEach(disableSite));
handlers.enableSite = ({ pattern }) => enableSite(pattern);
handlers.disableSite = async ({ pattern }) => {
  await chrome.permissions.remove({ origins: [pattern] });
  await disableSite(pattern);
};
