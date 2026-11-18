(function () {
  const $ = (id) => document.getElementById(id);
  ctFillLangSelects();

  function showProviderBlocks() {
    const p = $('provider').value;
    document.querySelectorAll('[data-for]').forEach((el) => {
      el.hidden = el.dataset.for !== p;
    });
  }

  function status(text, isError) {
    $('status').textContent = text;
    $('status').className = isError ? 'err' : 'ok';
  }

  async function load() {
    const s = await ctSend('getSettings');
    $('enabled').checked = s.enabled;
    $('targetLang').value = s.targetLang;
    $('replyLang').value = s.replyLang;
    $('fallbackReplyLang').value = s.fallbackReplyLang;
    $('translit').checked = s.translit;
    $('provider').value = s.provider;
    $('key-deepl').value = s.keys.deepl;
    $('key-google').value = s.keys.google;
    $('key-claude').value = s.keys.claude;
    $('key-pro').value = s.keys.pro;
    $('claudeModel').value = s.claudeModel;
    showProviderBlocks();
    $('cacheSize').textContent = await ctSend('cacheSize');
  }

  async function save() {
    await ctSend('saveSettings', {
      patch: {
        enabled: $('enabled').checked,
        targetLang: $('targetLang').value,
        replyLang: $('replyLang').value,
        fallbackReplyLang: $('fallbackReplyLang').value,
        translit: $('translit').checked,
        provider: $('provider').value,
        claudeModel: $('claudeModel').value.trim() || 'claude-opus-5-5',
        keys: {
          deepl: $('key-deepl').value.trim(),
          google: $('key-google').value.trim(),
          claude: $('key-claude').value.trim(),
          pro: $('key-pro').value.trim(),
        },
      },
    });
  }

  $('provider').addEventListener('change', showProviderBlocks);
  $('save').addEventListener('click', async () => {
    try {
      await save();
      status('Сохранено ✓');
    } catch (e) {
      status(e.message, true);
    }
  });
  $('test').addEventListener('click', async () => {
    try {
      await save();
      status('Проверяю…');
      const sample = `Hello! How are you today? (${new Date().toLocaleTimeString()})`;
      const [r] = await ctSend('translate', { texts: [sample], target: $('targetLang').value, source: 'auto' });
      status(`Работает: «${r.text}»`);
    } catch (e) {
      status(`Не работает: ${e.message}`, true);
    }
  });
  $('buyPro').addEventListener('click', () => ctSend('buyPro'));
  $('checkPro').addEventListener('click', async () => {
    const el = $('proStatus');
    try {
      await save();
      el.className = '';
      el.textContent = 'Проверяю…';
      const d = await ctSend('proStatus', { license: $('key-pro').value });
      el.className = 'ok';
      el.textContent = `Pro активен ✓ Использовано в этом месяце: ${d.used.toLocaleString()} из ${d.limit.toLocaleString()} символов`;
    } catch (e) {
      el.className = 'err';
      el.textContent = e.message;
    }
  });
  $('clearCache').addEventListener('click', async () => {
    await ctSend('clearCache');
    $('cacheSize').textContent = await ctSend('cacheSize');
  });

  load();
})();
