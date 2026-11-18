// Адаптер для Discord (discord.com/channels/...).
// ВСЕ СЕЛЕКТОРЫ — В ОБЪЕКТЕ SELECTORS. Свои сообщения Discord не помечает,
// поэтому они переводятся, только если написаны не на твоём языке.
(function () {
  const SELECTORS = {
    message: ['li[id^="chat-messages-"]'],
    // Текст самого сообщения (не цитата, на которую отвечают)
    text: ['div[id^="message-content-"]:not([class*="repliedTextContent"])'],
    strip: ['[class*="timestamp"]', '.ct-tr'],
    input: ['[role="textbox"][data-slate-editor="true"]', 'div[contenteditable="true"][role="textbox"]'],
  };

  const first = (root, list) => {
    for (const s of list) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  window.ChatTranslator.adapters.push({
    id: 'discord',
    name: 'Discord',
    SELECTORS,
    match(loc, doc) {
      if (/(^|\.)discord\.com$/.test(loc.hostname)) return true;
      const meta = doc.querySelector('meta[name="ct-adapter"]');
      return !!meta && meta.content === 'discord';
    },
    findMessages(doc) {
      return [...doc.querySelectorAll(SELECTORS.message.join(','))];
    },
    shouldSkip() {
      return false;
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
