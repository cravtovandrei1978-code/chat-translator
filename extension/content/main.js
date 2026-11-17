// Ядро на странице: следит за чатом, переводит новые сообщения, управляет панелью ответа.
(function () {
  const CT = window.ChatTranslator;
  if (CT.started) return;
  const adapter = CT.pickAdapter();
  if (!adapter) return;
  CT.started = true;

  const DONE = 'data-ct-done'; // 'pending' | 'ok' | 'same' | 'skip' | 'err'
  const INITIAL_LIMIT = 30; // за один раз переводим не больше последних N сообщений
  const BATCH = 20;

  let settings = null;
  let lastPartnerLang = null; // язык последнего входящего сообщения (не русского)
  let lastField = null; // последнее поле ввода сайта, куда кликал человек
  let scanTimer = null;
  let panel = null;
  let contextDead = false;

  // ---------- связь с фоновым скриптом ----------
  function send(type, payload = {}) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type, ...payload }, (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!res) return reject(new Error('Нет ответа от расширения'));
          if (!res.ok) {
            const e = new Error(res.error);
            e.code = res.code;
            return reject(e);
          }
          resolve(res.data);
        });
      } catch (e) {
        contextDead = true;
        reject(new Error('Расширение обновилось — перезагрузи страницу (F5)'));
      }
    });
  }

  // ---------- перевод входящих ----------
  function looksTranslatable(text) {
    if (!text || text.length < 2) return false;
    // только эмодзи, цифры, знаки — не переводим
    return /\p{L}{2,}/u.test(text);
  }

  function renderTranslation(msgEl, anchor, text) {
    let tr = msgEl.querySelector(':scope .ct-tr');
    if (!tr) {
      tr = document.createElement('div');
      tr.className = 'ct-tr';
      if (anchor && anchor.parentNode) anchor.insertAdjacentElement('afterend', tr);
      else msgEl.appendChild(tr);
    }
    tr.textContent = text;
  }

  async function translateMessages(items) {
    for (let i = 0; i < items.length; i += BATCH) {
      const chunk = items.slice(i, i + BATCH);
      try {
        const res = await send('translate', {
          texts: chunk.map((c) => c.text),
          target: settings.targetLang,
          source: 'auto',
        });
        chunk.forEach((c, j) => {
          const r = res[j];
          if (!r) return;
          if (r.src && r.src === settings.targetLang) {
            c.el.setAttribute(DONE, 'same');
            return;
          }
          if (r.src) lastPartnerLang = r.src;
          renderTranslation(c.el, c.anchor, r.text);
          c.el.setAttribute(DONE, 'ok');
        });
        updateLangInfo();
        if (!panelHasError) panel.clearError();
      } catch (e) {
        chunk.forEach((c) => c.el.setAttribute(DONE, 'err'));
        showError(e);
      }
    }
  }

  let panelHasError = false;
  function showError(e) {
    panelHasError = true;
    let msg = e.message || String(e);
    if (e.code === 'nokey') msg += ' (значок расширения → Настройки)';
    panel.setStatus(msg, true);
    setTimeout(() => (panelHasError = false), 5000);
  }

  function scan() {
    if (!settings || !settings.enabled || contextDead) return;
    const all = adapter.findMessages(document);
    const fresh = [];
    all.forEach((el) => {
      if (el.hasAttribute(DONE)) return;
      if (panel.contains(el)) return;
      if (adapter.shouldSkip(el)) return el.setAttribute(DONE, 'skip');
      const { text, anchor } = adapter.extract(el);
      if (!looksTranslatable(text)) return el.setAttribute(DONE, 'skip');
      fresh.push({ el, text, anchor });
    });
    let todo = fresh;
    // При открытии страницы или переключении чата не переводим всю историю, только последние N.
    if (fresh.length > INITIAL_LIMIT) {
      fresh.slice(0, fresh.length - INITIAL_LIMIT).forEach((c) => c.el.setAttribute(DONE, 'skip'));
      todo = fresh.slice(-INITIAL_LIMIT);
    }
    if (!todo.length) return;
    todo.forEach((c) => c.el.setAttribute(DONE, 'pending'));
    translateMessages(todo);
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 150);
  }

  // ---------- ответ ----------
  function replyTarget() {
    if (settings.replyLang && settings.replyLang !== 'auto') return settings.replyLang;
    return lastPartnerLang || settings.fallbackReplyLang || 'en';
  }

  function updateLangInfo() {
    const t = replyTarget().toUpperCase();
    panel.setLangInfo(`RU → ${t}${settings.replyLang === 'auto' ? ' (авто)' : ''}`);
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement) return true;
    return el instanceof HTMLInputElement && /^(text|search|)$/i.test(el.type);
  }

  document.addEventListener(
    'focusin',
    (e) => {
      const el = e.target;
      if (panel && panel.contains(el)) return;
      if (isEditable(el)) lastField = el;
    },
    true
  );

  async function onTranslate(text) {
    const target = replyTarget();
    panel.setStatus('Перевожу…');
    let source = settings.targetLang;
    let note = '';
    if (settings.translit && CT.looksLikeTranslit(text)) {
      text = CT.translitToCyrillic(text);
      note = `Понял как: «${text}»\n`;
    }
    try {
      const [r] = await send('translate', { texts: [text], target, source });
      panel.setPreview(note + r.text);
      const field = adapter.findInput(document) || (lastField && lastField.isConnected ? lastField : null);
      if (!field) {
        panel.setStatus('Поле чата не найдено. Кликни в поле чата и нажми ещё раз (или скопируй перевод).', true);
        return;
      }
      await CT.insertIntoField(field, r.text);
      panel.clearInput();
      panel.setStatus(`Вставлено (${target.toUpperCase()}). Проверь и нажми «Отправить» в чате.`);
    } catch (e) {
      showError(e);
    }
  }

  async function onToggle() {
    settings = await send('saveSettings', { patch: { enabled: !settings.enabled } });
    applySettings();
  }

  async function onReplyLangChange(code) {
    settings = await send('saveSettings', { patch: { replyLang: code } });
    applySettings();
  }

  function applySettings() {
    document.documentElement.classList.toggle('ct-off', !settings.enabled);
    panel.setEnabled(settings.enabled);
    panel.setReplyLang(settings.replyLang);
    updateLangInfo();
    if (settings.enabled) {
      // повторить сообщения, где была ошибка
      document.querySelectorAll(`[${DONE}="err"]`).forEach((el) => el.removeAttribute(DONE));
      scheduleScan();
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    send('getSettings').then((s) => {
      settings = s;
      applySettings();
    });
  });

  async function start() {
    panel = CT.createPanel({ onTranslate, onToggle, onReplyLangChange, onSettings: () => send('openOptions') });
    try {
      settings = await send('getSettings');
    } catch (e) {
      panel.setStatus(e.message, true);
      return;
    }
    applySettings();
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
    scan();
    console.info(`[ChatTranslator] адаптер: ${adapter.name}`);
  }

  start();
})();
