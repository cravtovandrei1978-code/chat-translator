// Адаптер для веб-чата Chaturbate.
//
// ВСЕ СЕЛЕКТОРЫ — В ОБЪЕКТЕ SELECTORS НИЖЕ. Если сайт поменял вёрстку и перевод перестал
// появляться, правь только этот блок. В каждом списке можно перечислить несколько
// вариантов: берётся первый, который нашёлся на странице.
//
// Как найти правильный селектор: на сайте нажми F12 → значок стрелки (выбор элемента) →
// кликни по сообщению в чате → посмотри атрибуты (class, data-testid) у блока сообщения.
(function () {
  const SELECTORS = {
    // Один блок = одно сообщение чата.
    message: [
      '[data-testid="chat-message"]',
      '.msg-text',
      '.chat-message',
      '#chat-messages .message',
    ],
    // Текст сообщения внутри блока. Если не найден — берём весь текст блока без имени.
    messageText: [
      '[data-testid="chat-message-text"]',
      '.message-text',
      '.msg-text-content',
    ],
    // Имя автора внутри блока (его не переводим).
    username: [
      '[data-testid="chat-message-username"]',
      '[data-testid="username"]',
      '.username',
    ],
    // Блоки, которые не надо переводить (уведомления о чаевых, системные сообщения).
    skip: ['.roomNotice', '.tip-message', '[data-testid="room-notice"]', '.notice'],
    // Поле ввода сообщения.
    input: [
      '[data-testid="chat-input"]',
      'div.customInput[contenteditable="true"]',
      'input.customInput',
      'textarea.chat-input',
      '#chat-input',
      '.chat-input-container [contenteditable="true"]',
      '.chat-input-container input[type="text"]',
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
    id: 'chaturbate',
    name: 'Chaturbate',
    SELECTORS,

    // На каком сайте включаться. Тестовая страница помечает себя <meta name="ct-adapter" content="chaturbate">.
    match(loc, doc) {
      if (/(^|\.)chaturbate\.com$/i.test(loc.hostname)) return true;
      const meta = doc.querySelector('meta[name="ct-adapter"]');
      return !!meta && meta.content === 'chaturbate';
    },

    // Все блоки сообщений на странице (по порядку).
    findMessages(doc) {
      const seen = new Set();
      const out = [];
      for (const sel of SELECTORS.message) {
        doc.querySelectorAll(sel).forEach((el) => {
          // берём самый внешний блок, если селекторы вложены друг в друга
          if (seen.has(el)) return;
          for (const s of seen) if (s.contains(el)) return;
          seen.add(el);
          out.push(el);
        });
        if (out.length) break;
      }
      return out;
    },

    shouldSkip(msgEl) {
      return SELECTORS.skip.some((s) => msgEl.matches(s) || msgEl.closest(s));
    },

    // Возвращает { text, anchor }: текст для перевода и элемент, после которого вставить перевод.
    extract(msgEl) {
      const textEl = first(msgEl, SELECTORS.messageText);
      if (textEl) return { text: textEl.innerText.trim(), anchor: textEl };
      const clone = msgEl.cloneNode(true);
      SELECTORS.username.forEach((s) => clone.querySelectorAll(s).forEach((n) => n.remove()));
      clone.querySelectorAll('.ct-tr').forEach((n) => n.remove());
      let text = (clone.innerText || clone.textContent || '').trim();
      text = text.replace(/^[:\s]+/, '');
      return { text, anchor: null };
    },

    findInput(doc) {
      return first(doc, SELECTORS.input);
    },
  });
})();
