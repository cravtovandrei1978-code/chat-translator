// Адаптер для Telegram Web (обе версии: web.telegram.org/k и web.telegram.org/a).
// ВСЕ СЕЛЕКТОРЫ — В ОБЪЕКТЕ SELECTORS. Свои сообщения (справа) не переводим.
(function () {
  const SELECTORS = {
    // Блок сообщения: версия K — .bubble, версия A — .Message
    message: ['.bubble[data-mid]', '.Message.message-list-item', '.Message'],
    // Признак своего сообщения
    outgoing: ['.is-out', '.own'],
    // Текст сообщения
    text: ['.translatable-message', '.text-content', '.message'],
    // Что убрать из текста перед переводом (время, реакции, имя)
    strip: ['.time', '.MessageMeta', '.reactions', '.Reactions', '.peer-title', '.message-title', '.ct-tr'],
    // Служебные строки (вступил в группу и т.п.)
    skip: ['.service', '.ActionMessage', '.is-date'],
    // Поле ввода
    input: [
      'div.input-message-input[contenteditable="true"]:not(.input-field-input-fake)',
      '#editable-message-text',
      '[contenteditable="true"][role="textbox"]',
    ],
  };

  const first = (root, list) => {
    for (const s of list) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  window.ChatTranslator.adapters.push({
    id: 'telegram',
    name: 'Telegram Web',
    SELECTORS,
    match(loc, doc) {
      if (loc.hostname === 'web.telegram.org') return true;
      const meta = doc.querySelector('meta[name="ct-adapter"]');
      return !!meta && meta.content === 'telegram';
    },
    findMessages(doc) {
      for (const sel of SELECTORS.message) {
        const list = doc.querySelectorAll(sel);
        if (list.length) return [...list];
      }
      return [];
    },
    shouldSkip(el) {
      if (SELECTORS.skip.some((s) => el.matches(s))) return true;
      return SELECTORS.outgoing.some((s) => el.matches(s));
    },
    extract(el) {
      const textEl = first(el, SELECTORS.text);
      if (!textEl) return { text: '', anchor: null };
      const clone = textEl.cloneNode(true);
      SELECTORS.strip.forEach((s) => clone.querySelectorAll(s).forEach((n) => n.remove()));
      return { text: (clone.textContent || '').trim(), anchor: textEl };
    },
    findInput(doc) {
      return first(doc, SELECTORS.input);
    },
  });
})();
