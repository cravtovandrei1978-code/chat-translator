// Настройки расширения. Хранятся в chrome.storage.local (только на этом компьютере).
// Ключи API вводит пользователь в окне настроек. В коде ключей нет и быть не должно.

export const DEFAULT_SETTINGS = {
  enabled: true,
  provider: 'deepl', // 'deepl' | 'google' | 'claude' | 'test'
  targetLang: 'ru', // на какой язык переводим входящие
  replyLang: 'auto', // на какой язык переводим ответ; 'auto' = язык последнего входящего
  fallbackReplyLang: 'en', // если язык собеседника ещё неизвестен
  translit: true, // ответ, написанный латиницей, сначала переводим транслитом в кириллицу
  keys: { deepl: '', google: '', claude: '' },
  claudeModel: 'claude-opus-5-5',
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return mergeSettings(settings);
}

export function mergeSettings(saved) {
  const s = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  s.keys = { ...DEFAULT_SETTINGS.keys, ...((saved && saved.keys) || {}) };
  return s;
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  if (patch.keys) next.keys = { ...current.keys, ...patch.keys };
  await chrome.storage.local.set({ settings: next });
  return next;
}
