// Выбор адаптера под текущий сайт.
// Новый сайт = новый файл в content/adapters/ + строка в manifest.json (matches и js).
(function () {
  const CT = window.ChatTranslator;
  CT.pickAdapter = function () {
    return CT.adapters.find((a) => {
      try {
        return a.match(location, document);
      } catch (_) {
        return false;
      }
    });
  };
})();
