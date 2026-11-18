(async function () {
  const $ = (id) => document.getElementById(id);
  try {
    await main($);
  } catch (e) {
    $('siteInfo').textContent = `Ошибка: ${e.message}`;
  }
})();

async function main($) {
  const NAMES = { deepl: 'DeepL', google: 'Google', claude: 'Claude', pro: 'Pro', test: 'Проверка (без перевода)' };
  ctFillLangSelects();
  const s = await ctSend('getSettings');
  $('enabled').checked = s.enabled;
  $('replyLang').value = s.replyLang;
  $('provider').textContent = NAMES[s.provider] || s.provider;
  if (s.provider !== 'test' && !s.keys[s.provider]) $('keyWarn').textContent = s.provider === 'pro' ? '— нет кода лицензии!' : '— нет ключа!';

  $('enabled').addEventListener('change', () =>
    ctSend('saveSettings', { patch: { enabled: $('enabled').checked } })
  );
  $('replyLang').addEventListener('change', () =>
    ctSend('saveSettings', { patch: { replyLang: $('replyLang').value } })
  );
  $('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('bug').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: window.CT_BUG_URL });
  });

  // ---- эта вкладка ----
  // Для теста можно передать вкладку: popup.html?tab=<id>
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  let tab = null;
  try {
    tab = forced ? await chrome.tabs.get(forced) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  } catch (_) {}
  let url = null;
  try {
    url = new URL(tab.url);
  } catch (_) {}
  if (!url || !/^https?:$/.test(url.protocol)) {
    $('siteInfo').textContent = 'На этой странице перевод недоступен.';
    return;
  }
  const pattern = `${url.protocol}//${url.host}/*`;
  // Спрашиваем страницу, работает ли на ней расширение. Если ответа нет за секунду — считаем, что не работает.
  const status = await Promise.race([
    chrome.tabs.sendMessage(tab.id, { type: 'ping' }).catch(() => null),
    new Promise((r) => setTimeout(() => r(null), 1000)),
  ]);
  const userSite = (s.sites || []).includes(pattern);
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
    let ok = false;
    try {
      ok = await chrome.permissions.request({ origins: [pattern] });
    } catch (e) {
      $('siteInfo').textContent = `Не получилось: ${e.message}`;
      return;
    }
    if (!ok) {
      $('siteInfo').textContent = 'Без разрешения перевод на этом сайте не включить.';
      return;
    }
    try {
      await ctSend('enableSite', { pattern });
      $('siteInfo').textContent = `Включено на ${url.host}. Нажми 🎯 на панели и кликни по сообщению собеседника.`;
      $('siteOn').hidden = true;
      $('siteOff').hidden = false;
    } catch (e) {
      $('siteInfo').textContent = `Не получилось включить: ${e.message}`;
    }
  });
  $('siteOff').addEventListener('click', async () => {
    await ctSend('disableSite', { pattern });
    $('siteInfo').textContent = `Выключено на ${url.host}. Обнови страницу.`;
    $('siteOff').hidden = true;
    $('siteOn').hidden = false;
  });
}
