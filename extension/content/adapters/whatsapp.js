// Адаптер для WhatsApp Web (web.whatsapp.com).
//
// ВСЕ СЕЛЕКТОРЫ — В ОБЪЕКТЕ SELECTORS. Если WhatsApp поменял вёрстку, правь только его.
// Переводим только входящие сообщения (.message-in), свои (.message-out) не трогаем.
(function () {
  const SELECTORS = {
    // Блок входящего сообщения.
    message: ['div.message-in', '[data-testid="msg-container"].message-in'],
    // Обёртка текста. У основного текста есть атрибут data-pre-plain-text («[12:00, 18.11.2026] Имя: »).
    textWrap: ['.copyable-text[data-pre-plain-text]'],
    // Сам текст внутри обёртки.
    text: ['span.selectable-text', '[data-testid="selectable-text"]'],
    // Что не переводим: удалённые сообщения, системные строки.
    skip: ['[data-testid="recalled-msg"]', '[data-icon="recalled"]'],
    // Поле ввода сообщения внизу чата.
    input: [
      'footer div[contenteditable="true"][data-tab="10"]',
      'footer [contenteditable="true"][role="textbox"]',
      'footer div[contenteditable="true"]',
      '#main footer [contenteditable="true"]',
    ],
  };

  function first(root, list) {
    for (const sel of list) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  window.ChatTranslator.adapters.push({
    id: 'whatsapp',
    name: 'WhatsApp Web',
    SELECTORS,

    match(loc, doc) {
      if (loc.hostname === 'web.whatsapp.com') return true;
      const meta = doc.querySelector('meta[name="ct-adapter"]');
      return !!meta && meta.content === 'whatsapp';
    },

    findMessages(doc) {
      for (const sel of SELECTORS.message) {
        const list = doc.querySelectorAll(sel);
        if (list.length) return [...list];
      }
      return [];
    },

    shouldSkip(msgEl) {
      return SELECTORS.skip.some((s) => msgEl.querySelector(s));
    },

    extract(msgEl) {
      const wrap = first(msgEl, SELECTORS.textWrap);
      if (!wrap) return { text: '', anchor: null }; // фото, стикер, голосовое без текста
      const textEl = first(wrap, SELECTORS.text) || wrap;
      return { text: (textEl.innerText || '').trim(), anchor: wrap };
    },

    findInput(doc) {
      return first(doc, SELECTORS.input);
    },
  });
})();
