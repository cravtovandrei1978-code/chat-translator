(async function () {
  const $ = (id) => document.getElementById(id);
  const NAMES = { deepl: 'DeepL', google: 'Google', claude: 'Claude', test: 'Проверка (без перевода)' };
  ctFillLangSelects();
  const s = await ctSend('getSettings');
  $('enabled').checked = s.enabled;
  $('replyLang').value = s.replyLang;
  $('provider').textContent = NAMES[s.provider] || s.provider;
  if (s.provider !== 'test' && !s.keys[s.provider]) $('keyWarn').textContent = '— нет ключа!';

  $('enabled').addEventListener('change', () =>
    ctSend('saveSettings', { patch: { enabled: $('enabled').checked } })
  );
  $('replyLang').addEventListener('change', () =>
    ctSend('saveSettings', { patch: { replyLang: $('replyLang').value } })
  );
  $('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
})();
