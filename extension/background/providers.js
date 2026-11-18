// Провайдеры перевода. Каждый получает массив текстов и возвращает
// массив { text, src } той же длины (src = определённый язык оригинала, если провайдер его знает).
// Коды языков внутри расширения: двухбуквенные ISO в нижнем регистре ('en', 'ru', 'de'...).

import { PRO_API } from './config.js';

export class TranslateError extends Error {
  constructor(message, { code = 'error' } = {}) {
    super(message);
    this.code = code;
  }
}

async function readError(res) {
  let body = '';
  try {
    body = await res.text();
  } catch (_) {}
  if (res.status === 401 || res.status === 403)
    return new TranslateError('Неверный или неподходящий ключ API', { code: 'auth' });
  if (res.status === 456) return new TranslateError('Закончился лимит символов DeepL', { code: 'quota' });
  if (res.status === 429) return new TranslateError('Слишком много запросов, подожди немного', { code: 'rate' });
  return new TranslateError(`Ошибка ${res.status}: ${body.slice(0, 200)}`);
}

// ---------- DeepL ----------
function deeplTarget(lang) {
  const l = lang.toLowerCase();
  if (l === 'en') return 'EN-US';
  if (l === 'pt') return 'PT-BR';
  if (l === 'zh') return 'ZH-HANS';
  return l.toUpperCase();
}

async function deepl(texts, target, source, key) {
  if (!key) throw new TranslateError('Не указан ключ DeepL в настройках', { code: 'nokey' });
  const host = key.trim().endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const body = { text: texts, target_lang: deeplTarget(target) };
  if (source && source !== 'auto') body.source_lang = source.toUpperCase();
  const res = await fetch(`${host}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${key.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  return data.translations.map((t) => ({
    text: t.text,
    src: (t.detected_source_language || '').slice(0, 2).toLowerCase(),
  }));
}

// ---------- Google Cloud Translation (v2, ключ API) ----------
function decodeEntities(s) {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function google(texts, target, source, key) {
  if (!key) throw new TranslateError('Не указан ключ Google в настройках', { code: 'nokey' });
  const body = { q: texts, target, format: 'text' };
  if (source && source !== 'auto') body.source = source;
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key.trim())}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  return data.data.translations.map((t) => ({
    text: decodeEntities(t.translatedText),
    src: (t.detectedSourceLanguage || source || '').slice(0, 2).toLowerCase(),
  }));
}

// ---------- Claude (Anthropic Messages API) ----------
const LANG_NAMES = {
  ru: 'Russian', en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian',
  pt: 'Portuguese', pl: 'Polish', uk: 'Ukrainian', tr: 'Turkish', nl: 'Dutch', ja: 'Japanese',
  zh: 'Chinese', ko: 'Korean', ar: 'Arabic', ro: 'Romanian', cs: 'Czech', sv: 'Swedish',
};

async function claude(texts, target, source, key, model) {
  if (!key) throw new TranslateError('Не указан ключ Claude в настройках', { code: 'nokey' });
  const targetName = LANG_NAMES[target] || target;
  const system =
    `You are a chat translator. Translate every input message into ${targetName}. ` +
    'Keep the tone, slang, emoji and names. Do not add explanations. ' +
    'For each message also return the ISO 639-1 code of its original language.';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key.trim(),
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              translations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { text: { type: 'string' }, src: { type: 'string' } },
                  required: ['text', 'src'],
                  additionalProperties: false,
                },
              },
            },
            required: ['translations'],
            additionalProperties: false,
          },
        },
      },
      system,
      messages: [
        {
          role: 'user',
          content:
            `Translate these ${texts.length} messages (JSON array, keep the same order and count):\n` +
            JSON.stringify(texts),
        },
      ],
    }),
  });
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new TranslateError('Claude отказался переводить это сообщение');
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new TranslateError('Пустой ответ Claude');
  const parsed = JSON.parse(textBlock.text);
  const out = parsed.translations || [];
  if (out.length !== texts.length) throw new TranslateError('Claude вернул не столько переводов, сколько сообщений');
  return out.map((t) => ({ text: t.text, src: (t.src || '').slice(0, 2).toLowerCase() }));
}

// ---------- Pro: наш сервер, ключ не нужен, только код лицензии ----------
async function pro(texts, target, source, license, api) {
  if (!license) throw new TranslateError('Введи код лицензии Pro в настройках', { code: 'nokey' });
  let res;
  try {
    res = await fetch(`${api || PRO_API}/v1/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: license.trim(), texts, target, source }),
    });
  } catch (_) {
    throw new TranslateError('Сервер Pro недоступен, попробуй позже');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new TranslateError('Код лицензии Pro неверный или подписка закончилась', { code: 'auth' });
  if (res.status === 429) throw new TranslateError('Закончился месячный лимит Pro', { code: 'quota' });
  if (!res.ok) throw new TranslateError(`Ошибка сервера Pro (${data.error || res.status})`);
  return data.translations;
}

// ---------- Проверка (без интернета и без ключа) ----------
// Нужен, чтобы проверить, что расширение находит сообщения и поле ввода на сайте.
async function testProvider(texts, target) {
  return texts.map((t) => ({
    text: `[${target.toUpperCase()}] ${t}`,
    src: /[а-яё]/i.test(t) ? 'ru' : 'en',
  }));
}

export async function translateBatch(settings, texts, target, source) {
  switch (settings.provider) {
    case 'deepl':
      return deepl(texts, target, source, settings.keys.deepl);
    case 'google':
      return google(texts, target, source, settings.keys.google);
    case 'claude':
      return claude(texts, target, source, settings.keys.claude, settings.claudeModel);
    case 'pro':
      return pro(texts, target, source, settings.keys.pro, settings.proApi);
    case 'test':
      return testProvider(texts, target);
    default:
      throw new TranslateError(`Неизвестный провайдер: ${settings.provider}`);
  }
}
