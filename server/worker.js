// Сервер Chat Translator Pro (Cloudflare Worker).
// Проверяет лицензию Polar и переводит через наш ключ DeepL.
//
// Переменные окружения (секреты задаются в Cloudflare, в код не пишем):
//   DEEPL_KEY      — ключ DeepL API (секрет)
//   POLAR_ORG_ID   — ID организации в Polar
//   POLAR_API      — https://api.polar.sh (или https://sandbox-api.polar.sh для проверки)
//   MONTHLY_CHARS  — лимит символов на одну лицензию в месяц (по умолчанию 500000)
// Привязка KV: USAGE — счётчики символов и кэш проверок лицензий.

const LICENSE_TTL = 3600; // проверку лицензии храним час

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

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Простое хранилище: KV в Cloudflare, Map при локальном запуске.
function store(env) {
  if (env.USAGE) return env.USAGE;
  globalThis.__ctMem ||= new Map();
  const m = globalThis.__ctMem;
  return { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v) };
}

async function checkLicense(env, license) {
  const kv = store(env);
  const id = await sha256(license);
  const cached = await kv.get(`lic:${id}`);
  if (cached) return { id, ok: cached === 'ok' };
  const res = await fetch(`${env.POLAR_API || 'https://api.polar.sh'}/v1/customer-portal/license-keys/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: license, organization_id: env.POLAR_ORG_ID }),
  });
  if (res.status >= 500) throw new Error('polar_unavailable');
  let ok = false;
  if (res.ok) {
    const d = await res.json();
    ok = d.status === 'granted' && (!d.expires_at || new Date(d.expires_at) > new Date());
  }
  await kv.put(`lic:${id}`, ok ? 'ok' : 'bad', { expirationTtl: ok ? LICENSE_TTL : 300 });
  return { id, ok };
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
  if (req.method !== 'POST') return json({ error: 'not_found' }, 404);
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'bad_request' }, 400);
  }
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
