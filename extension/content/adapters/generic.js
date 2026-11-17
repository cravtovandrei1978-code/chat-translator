// Универсальный адаптер для любого сайта, где человек сам включил перевод.
// Какие блоки считать сообщениями, человек показывает кликом (кнопка 🎯 на панели).
// Правило сохраняется в настройках для этого сайта: settings.siteRules[host] = { message: 'css-селектор' }.
// Подключается последним: работает, только если ни один специальный адаптер не подошёл.
(function () {
  const CT = window.ChatTranslator;

  CT.adapters.push({
    id: 'generic',
    name: 'Любой сайт',
    generic: true,
    rule: null, // ставит main.js из настроек
    match() {
      return true;
    },
    findMessages(doc) {
      if (!this.rule || !this.rule.message) return [];
      try {
        return [...doc.querySelectorAll(this.rule.message)];
      } catch (_) {
        return [];
      }
    },
    shouldSkip() {
      return false;
    },
    extract(el) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.ct-tr, time, button, svg, img').forEach((n) => n.remove());
      clone.querySelectorAll('*').forEach((n) => n.append(' ')); // пробелы между частями
      return { text: (clone.textContent || '').replace(/\s+/g, ' ').trim(), anchor: null };
    },
    findInput() {
      return null; // берётся поле, по которому человек кликнул последним
    },
  });

  // Подбор селектора по клику: ищем ближайшего предка, у которого много «братьев»
  // с той же разметкой — это и есть элемент списка сообщений.
  function signature(el) {
    const cls = [...el.classList].filter((c) => !c.startsWith('ct-')).sort();
    return el.tagName.toLowerCase() + cls.map((c) => '.' + CSS.escape(c)).join('');
  }

  CT.selectorFromClick = function (target) {
    let el = target;
    while (el && el !== document.body && el.parentElement) {
      const sig = signature(el);
      const siblings = [...el.parentElement.children].filter((s) => signature(s) === sig);
      if (siblings.length >= 3 && (el.textContent || '').trim()) {
        if (el.classList.length) {
          const n = document.querySelectorAll(sig).length;
          if (n >= 3 && n <= 3000) return sig;
        }
        const parentSig = signature(el.parentElement);
        if (el.parentElement.classList.length) return `${parentSig} > ${el.tagName.toLowerCase()}`;
      }
      el = el.parentElement;
    }
    return null;
  };
})();
