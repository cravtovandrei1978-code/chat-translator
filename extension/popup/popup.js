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

  // ---- эта вкладка ----
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let url = null;
  try {
    url = new URL(tab.url);
  } catch (_) {}
  if (!url || !/^https?:$/.test(url.protocol)) {
    $('siteInfo').textContent = 'На этой странице перевод недоступен.';
    return;
  }
  const pattern = `${url.protocol}//${url.host}/*`;
  let status = null;
  try {
    status = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
  } catch (_) {}
  const userSite = s.sites.includes(pattern);
  if (status && !status.generic) {
    $('siteInfo').textContent = `Работает на этой вкладке: ${status.adapter}.`;
  } else if (status || userSite) {
    $('siteInfo').textContent = `Перевод включён на ${url.host}. Если сообщения не переводятся, нажми 🎯 на панели и кликни по сообщению.`;
    $('siteOff').hidden = false;
  } else {
    $('siteInfo').textContent = `На ${url.host} перевод пока выключен.`;
    $('siteOn').hidden = false;
  }
  $('siteOn').addEventListener('click', async () => {
    // Chrome спросит разрешение на этот сайт; дальше всё сделает фоновый скрипт.
    const ok = await chrome.permissions.request({ origins: [pattern] });
    if (ok) {
      await ctSend('enableSite', { pattern });
      $('siteInfo').textContent = `Включено на ${url.host}. Нажми 🎯 на панели и кликни по сообщению собеседника.`;
      $('siteOn').hidden = true;
      $('siteOff').hidden = false;
    }
  });
  $('siteOff').addEventListener('click', async () => {
    await ctSend('disableSite', { pattern });
    $('siteInfo').textContent = `Выключено на ${url.host}. Обнови страницу.`;
    $('siteOff').hidden = true;
    $('siteOn').hidden = false;
  });
})();
