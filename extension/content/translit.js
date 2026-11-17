// Транслит → кириллица для поля ответа: «sei4as moje6i» → «сейчас можешь».
// Включается в настройках («Пишу транслитом»). Срабатывает, только если в тексте нет русских букв.
(function () {
  const CT = window.ChatTranslator;

  // Целые слова, которые правилами не угадать.
  const WORDS = {
    eto: 'это', etot: 'этот', eta: 'эта', eti: 'эти', etom: 'этом', etu: 'эту', etogo: 'этого',
    ti: 'ты', vi: 'вы', mi: 'мы', i: 'и', ja: 'я', ok: 'ок', da: 'да', net: 'нет',
  };

  // Порядок важен: сначала длинные сочетания.
  const MULTI = [
    ['shch', 'щ'], ['sch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'],
    ['ea', 'я'], ['ia', 'я'], ['ya', 'я'],
    ['iu', 'ю'], ['yu', 'ю'], ['io', 'ё'], ['yo', 'ё'],
    ['ye', 'е'],
  ];
  const SINGLE = {
    a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м',
    n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', f: 'ф', h: 'х', c: 'ц', w: 'ш', y: 'ы',
    q: 'к', x: 'кс', "'": 'ь', '4': 'ч', '6': 'ш', '9': 'я',
  };
  const VOWELS = 'аеёиоуыэюя';

  function convertWord(word) {
    const lower = word.toLowerCase();
    if (WORDS[lower]) return matchCase(word, WORDS[lower]);
    let out = '';
    for (let i = 0; i < lower.length; ) {
      const rest = lower.slice(i);
      const m = MULTI.find(([lat]) => rest.startsWith(lat));
      if (m) {
        out += m[1];
        i += m[0].length;
        continue;
      }
      const ch = lower[i];
      const prev = out[out.length - 1];
      const isLast = i === lower.length - 1;
      if (ch === 'i' && prev && VOWELS.includes(prev)) out += 'й'; // sei4as → сейчас
      else if (ch === 'i' && isLast && prev && !VOWELS.includes(prev) && out.length > 1) {
        // окончание: moje6i → можешь, esti → есть, dostupi → доступы, smotri → смотри
        out += 'шчщжт'.includes(prev) ? 'ь' : 'бвдмпф'.includes(prev) ? 'ы' : 'и';
      } else if (ch === 'e' && i === 0) out += 'е';
      else out += SINGLE[ch] !== undefined ? SINGLE[ch] : ch;
      i += 1;
    }
    return matchCase(word, out);
  }

  function matchCase(src, dst) {
    if (src.length > 1 && src === src.toUpperCase() && /[a-z]/i.test(src)) return dst.toUpperCase();
    if (src[0] && src[0] !== src[0].toLowerCase()) return dst[0].toUpperCase() + dst.slice(1);
    return dst;
  }

  CT.looksLikeTranslit = function (text) {
    return /[a-z]/i.test(text) && !/[а-яё]/i.test(text);
  };

  CT.translitToCyrillic = function (text) {
    // Слово = латинские буквы, апостроф и цифры 4/6/9 внутри слова (6:40 и 2026 не трогаем).
    return text.replace(/[a-z'][a-z'469]*|[469]+(?=[a-z])[a-z'469]*/gi, (w) => convertWord(w));
  };
})();
