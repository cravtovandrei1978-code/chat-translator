// Список языков для выпадающих меню и общая функция связи с фоновым скриптом.
window.CT_LANGS = [
  ['ru', 'Русский'], ['en', 'Английский'], ['de', 'Немецкий'], ['fr', 'Французский'],
  ['es', 'Испанский'], ['it', 'Итальянский'], ['pt', 'Португальский'], ['pl', 'Польский'],
  ['uk', 'Украинский'], ['tr', 'Турецкий'], ['nl', 'Нидерландский'], ['ja', 'Японский'],
  ['zh', 'Китайский'], ['ko', 'Корейский'],
];

window.ctFillLangSelects = function (root = document) {
  root.querySelectorAll('select[data-langs]').forEach((sel) => {
    if (sel.hasAttribute('data-auto')) sel.add(new Option('Язык собеседника (авто)', 'auto'));
    window.CT_LANGS.forEach(([code, name]) => sel.add(new Option(name, code)));
  });
};

window.ctSend = function (type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res || !res.ok) return reject(new Error((res && res.error) || 'Нет ответа'));
      resolve(res.data);
    });
  });
};

// Куда сообщать об ошибках (публичный репозиторий только для жалоб и вопросов).
window.CT_BUG_URL = 'https://github.com/cravtovandrei1978-code/chat-translator-support/issues/new';
