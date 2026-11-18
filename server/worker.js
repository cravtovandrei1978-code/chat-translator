// Сервер Chat Translator Pro (Cloudflare Worker).
// Продажа через Paddle (выплаты на Payoneer), перевод через наш ключ DeepL.
//
// Код лицензии = <id подписки Paddle>.<подпись>. Подпись делает сервер секретом
// LICENSE_SECRET, поэтому код нельзя подделать, а хранить коды не нужно.
// Покупатель получает код на странице /buy сразу после оплаты, а потерянный
// код восстанавливает на /restore по номеру заказа из письма Paddle (txn_…).
//
// Переменные окружения (секреты задаются в Cloudflare, в код не пишем):
//   DEEPL_KEY           — ключ DeepL API (секрет)
//   PADDLE_API_KEY      — ключ API Paddle (секрет)
//   LICENSE_SECRET      — длинная случайная строка для подписи кодов (секрет)
//   PADDLE_ENV          — 'sandbox' для проверки или 'production'
//   PADDLE_CLIENT_TOKEN — клиентский токен Paddle (не секрет, нужен странице оплаты)
//   PADDLE_PRICE_ID     — id цены подписки (pri_…)
//   MONTHLY_CHARS       — лимит символов на одну лицензию в месяц (по умолчанию 500000)
// Привязка KV: USAGE — счётчики символов и кэш проверок.

import { pageResponse } from './pages.js';

const LICENSE_TTL = 3600; // статус подписки перепроверяем раз в час
const OK_STATUSES = ['active', 'trialing', 'past_due'];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(s) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

async function sign(env, subId) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.LICENSE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(subId))).slice(0, 24);
}

export async function makeLicense(env, subId) {
  return `${subId}.${await sign(env, subId)}`;
}

// Простое хранилище: KV в Cloudflare, Map при локальном запуске.
function store(env) {
  if (env.USAGE) return env.USAGE;
  globalThis.__ctMem ||= new Map();
  const m = globalThis.__ctMem;
  return { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v) };
}

function paddleBase(env) {
  if (env.PADDLE_API) return env.PADDLE_API;
  return env.PADDLE_ENV === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

async function paddleGet(env, path) {
  const res = await fetch(`${paddleBase(env)}${path}`, {
    headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`paddle_${res.status}`);
  return (await res.json()).data;
}

async function checkLicense(env, license) {
  const [subId, sig] = license.split('.');
  if (!subId || !sig || sig !== (await sign(env, subId))) return { ok: false };
  const kv = store(env);
  const id = await sha256(subId);
  const cached = await kv.get(`lic:${id}`);
  if (cached) return { id, ok: cached === 'ok' };
  const sub = await paddleGet(env, `/subscriptions/${encodeURIComponent(subId)}`);
  const ok = !!sub && OK_STATUSES.includes(sub.status);
  await kv.put(`lic:${id}`, ok ? 'ok' : 'bad', { expirationTtl: ok ? LICENSE_TTL : 300 });
  return { id, ok };
}

// Код лицензии по номеру заказа (txn_…): после оплаты и для восстановления.
async function claim(env, txnId) {
  if (!/^txn_[a-z0-9]+$/i.test(txnId || '')) return json({ error: 'bad_request' }, 400);
  const txn = await paddleGet(env, `/transactions/${txnId}`);
  if (!txn || !txn.subscription_id || !['paid', 'completed'].includes(txn.status))
    return json({ error: 'not_paid' }, 404);
  return json({ license: await makeLicense(env, txn.subscription_id) });
}

function month() {
  return new Date().toISOString().slice(0, 7);
}

function deeplTarget(lang) {
  const l = String(lang).toLowerCase();
  return { en: 'EN-US', pt: 'PT-BR', zh: 'ZH-HANS' }[l] || l.toUpperCase();
}

async function handle(req, env) {
  if (req.method === 'OPTIONS') return json({});
  const url = new URL(req.url);
  if (req.method === 'GET') return pageResponse(url.pathname, env);
  if (req.method !== 'POST') return json({ error: 'not_found' }, 404);
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'bad_request' }, 400);
  }
  if (url.pathname === '/v1/claim') return claim(env, String(body.transaction_id || '').trim());
  const license = String(body.license || '').trim();
  if (!license) return json({ error: 'no_license' }, 401);
  const lic = await checkLicense(env, license);
  if (!lic.ok) return json({ error: 'invalid_license' }, 401);

  const kv = store(env);
  const limit = Number(env.MONTHLY_CHARS || 500000);
  const usageKey = `use:${lic.id}:${month()}`;
  const used = Number((await kv.get(usageKey)) || 0);

  if (url.pathname === '/v1/license') return json({ ok: true, used, limit });

  if (url.pathname === '/v1/translate') {
    const texts = Array.isArray(body.texts) ? body.texts.map(String).slice(0, 50) : [];
    if (!texts.length || !body.target) return json({ error: 'bad_request' }, 400);
    const chars = texts.reduce((n, t) => n + t.length, 0);
    if (used + chars > limit) return json({ error: 'quota', used, limit }, 429);
    const payload = { text: texts, target_lang: deeplTarget(body.target) };
    if (body.source && body.source !== 'auto') payload.source_lang = String(body.source).toUpperCase();
    const host = env.DEEPL_API || (String(env.DEEPL_KEY).endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com');
    const res = await fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${env.DEEPL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return json({ error: 'upstream', status: res.status }, 502);
    const data = await res.json();
    await kv.put(usageKey, String(used + chars), { expirationTtl: 40 * 86400 });
    return json({
      translations: data.translations.map((t) => ({
        text: t.text,
        src: (t.detected_source_language || '').slice(0, 2).toLowerCase(),
      })),
      used: used + chars,
      limit,
    });
  }
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(req, env) {
    try {
      return await handle(req, env);
    } catch (e) {
      return json({ error: 'server', message: e.message }, 503);
    }
  },
};
