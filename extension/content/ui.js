// Панель «Мой ответ»: пишешь по-русски → перевод вставляется в поле чата сайта.
// Отправку сообщения на сайте человек нажимает сам.
(function () {
  const CT = window.ChatTranslator;

  const LANGS = {
    auto: 'авто', en: 'EN', ru: 'RU', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT',
    pl: 'PL', uk: 'UK', tr: 'TR', nl: 'NL', ja: 'JA', zh: 'ZH', ko: 'KO',
  };

  const STYLE = `
    :host { all: initial; }
    .box { position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; width: 320px;
      font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2433;
      background: #fff; border: 1px solid #c9d1e0; border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0,0,0,.18); overflow: hidden; }
    .head { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: #2f6fde; color: #fff;
      cursor: move; user-select: none; }
    .title { font-weight: 600; flex: 1; }
    .lang { font-size: 12px; opacity: .9; }
    .icon { background: none; border: 0; color: #fff; font-size: 16px; cursor: pointer; padding: 0 2px; }
    .body { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
    .collapsed .body { display: none; }
    textarea { width: 100%; box-sizing: border-box; min-height: 60px; resize: vertical; padding: 6px 8px;
      border: 1px solid #c9d1e0; border-radius: 6px; font: inherit; color: inherit; }
    textarea:focus { outline: 2px solid #2f6fde55; border-color: #2f6fde; }
    .row { display: flex; gap: 6px; align-items: center; }
    select { font: inherit; padding: 3px; border: 1px solid #c9d1e0; border-radius: 6px; }
    button.main { flex: 1; padding: 6px 10px; border: 0; border-radius: 6px; background: #2f6fde; color: #fff;
      font: inherit; font-weight: 600; cursor: pointer; }
    button.main:disabled { opacity: .6; cursor: default; }
    .preview { background: #f2f5fb; border-radius: 6px; padding: 6px 8px; white-space: pre-wrap; word-break: break-word; }
    .preview:empty { display: none; }
    .status { font-size: 12px; color: #5b6577; min-height: 16px; }
    .status.err { color: #c0392b; }
    .hint { font-size: 11px; color: #8a93a5; }
  `;

  CT.createPanel = function ({ onTranslate, onToggle, onReplyLangChange, onSettings }) {
    const host = document.createElement('div');
    host.id = 'chat-translator-panel';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="box">
        <div class="head">
          <span class="title">Переводчик</span>
          <span class="lang" data-el="langInfo"></span>
          <button class="icon" data-el="settings" title="Настройки">⚙</button>
          <button class="icon" data-el="power" title="Включить/выключить перевод">⏻</button>
          <button class="icon" data-el="collapse" title="Свернуть">–</button>
        </div>
        <div class="body">
          <textarea data-el="input" placeholder="Напиши ответ по-русски…"></textarea>
          <div class="row">
            <select style="max-width:140px" data-el="replyLang" title="На какой язык переводить ответ"></select>
            <button class="main" data-el="go">Перевести и вставить</button>
          </div>
          <div class="preview" data-el="preview"></div>
          <div class="status" data-el="status"></div>
          <div class="hint">Ctrl+Enter — перевести. Отправку в чате нажимаешь сама. Панель можно перетащить за заголовок.</div>
        </div>
      </div>`;
    const $ = (name) => root.querySelector(`[data-el="${name}"]`);
    const box = root.querySelector('.box');

    for (const [code, label] of Object.entries(LANGS)) {
      if (code === 'ru') continue;
      const o = document.createElement('option');
      o.value = code;
      o.textContent = code === 'auto' ? 'Язык собеседника (авто)' : label;
      $('replyLang').appendChild(o);
    }

    const go = async () => {
      const text = $('input').value.trim();
      if (!text) return;
      $('go').disabled = true;
      try {
        await onTranslate(text);
      } finally {
        $('go').disabled = false;
      }
    };
    $('go').addEventListener('click', go);
    $('input').addEventListener('keydown', (e) => {
      e.stopPropagation(); // чтобы горячие клавиши сайта не перехватывали ввод
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        go();
      }
    });
    ['keyup', 'keypress'].forEach((t) => $('input').addEventListener(t, (e) => e.stopPropagation()));
    $('collapse').addEventListener('click', () => box.classList.toggle('collapsed'));
    $('power').addEventListener('click', () => onToggle());
    $('settings').addEventListener('click', () => onSettings());
    $('replyLang').addEventListener('change', () => onReplyLangChange($('replyLang').value));

    // Перетаскивание панели за заголовок
    const head = root.querySelector('.head');
    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      const r = box.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      const move = (ev) => {
        box.style.left = Math.max(0, ev.clientX - dx) + 'px';
        box.style.top = Math.max(0, ev.clientY - dy) + 'px';
                box.style.bottom = 'auto';
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });

    document.documentElement.appendChild(host);

    return {
      host,
      setStatus(text, isError = false) {
        $('status').textContent = text || '';
        $('status').classList.toggle('err', !!isError);
      },
      clearError() {
        if ($('status').classList.contains('err')) this.setStatus('');
      },
      setPreview(text) {
        $('preview').textContent = text || '';
      },
      clearInput() {
        $('input').value = '';
      },
      setReplyLang(code) {
        $('replyLang').value = code;
      },
      setLangInfo(text) {
        $('langInfo').textContent = text;
      },
      setEnabled(on) {
        $('power').style.opacity = on ? '1' : '.45';
        $('power').title = on ? 'Перевод включён (нажми, чтобы выключить)' : 'Перевод выключен (нажми, чтобы включить)';
      },
      contains(el) {
        return el === host || host.contains(el);
      },
    };
  };

  // Вставка текста в поле ввода сайта так, чтобы сайт «увидел» изменение.
  CT.insertIntoField = async function (el, text) {
    el.focus();
    if (el.isContentEditable) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      const ok = document.execCommand('insertText', false, text);
      // Редакторы вроде WhatsApp (Lexical) обновляют поле не сразу — ждём, и только если пусто, вставляем вручную.
      if (ok) await new Promise((r) => setTimeout(r, 150));
      if (!ok || !el.textContent.trim()) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      }
    } else {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      try {
        el.setSelectionRange(text.length, text.length);
      } catch (_) {}
    }
  };
})();
