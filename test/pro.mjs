// Тест Pro: поднимает сервер (worker.js) с поддельными Paddle и DeepL,
// проверяет лицензию, лимит и перевод через расширение.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { makeLicense } from '../server/worker.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failed = 0;
const check = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) failed++; };

const listen = (h) => new Promise((r) => { const s = http.createServer(h); s.listen(0, '127.0.0.1', () => r(s)); });
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });

// Поддельные Paddle и DeepL
let deeplCalls = 0;
const SUBS = { sub_good: 'active', sub_old: 'canceled' };
const TXNS = { txn_good: { status: 'completed', subscription_id: 'sub_good' }, txn_wait: { status: 'ready', subscription_id: null } };
const fake = await listen(async (req, res) => {
  const body = JSON.parse((await readBody(req)) || '{}');
  const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (req.url.startsWith('/subscriptions/') || req.url.startsWith('/transactions/')) {
    if (req.headers.authorization !== 'Bearer PADDLE-SECRET') return send(403, {});
    const id = req.url.split('/')[2];
    if (SUBS[id]) return send(200, { data: { id, status: SUBS[id] } });
    if (TXNS[id]) return send(200, { data: { id, ...TXNS[id] } });
    return send(404, {});
  }
  if (req.url === '/v2/translate') {
    deeplCalls++;
    check(req.headers.authorization === 'DeepL-Auth-Key SECRET', 'сервер: ключ DeepL передаётся только с сервера');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ translations: body.text.map((t) => ({ text: `[${body.target_lang}] ${t}`, detected_source_language: 'EN' })) }));
  }
  res.writeHead(404); res.end();
});
const fakeUrl = `http://127.0.0.1:${fake.address().port}`;
const env = { PADDLE_API: fakeUrl, PADDLE_API_KEY: 'PADDLE-SECRET', LICENSE_SECRET: 'sign-secret', DEEPL_API: fakeUrl, DEEPL_KEY: 'SECRET', MONTHLY_CHARS: '60' };
const GOOD = await makeLicense(env, 'sub_good');
const OLD = await makeLicense(env, 'sub_old');

// Сервер Pro (worker.js через http)
const api = await listen(async (req, res) => {
  const body = await readBody(req);
  const r = await worker.fetch(new Request(`http://x${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text());
});
const apiUrl = `http://127.0.0.1:${api.address().port}`;
const call = async (p, b) => { const r = await fetch(apiUrl + p, { method: 'POST', body: JSON.stringify(b) }); return { status: r.status, data: await r.json() }; };

try {
  let r = await call('/v1/translate', { license: 'BAD', texts: ['Hi'], target: 'ru' });
  check(r.status === 401, 'сервер: неверный код отклонён');
  r = await call('/v1/license', { license: 'sub_good.000000000000000000000000' });
  check(r.status === 401, 'сервер: поддельная подпись отклонена');
  r = await call('/v1/license', { license: OLD });
  check(r.status === 401, 'сервер: отменённая подписка отклонена');
  r = await call('/v1/claim', { transaction_id: 'txn_good' });
  check(r.data.license === GOOD, 'сервер: после оплаты выдаётся код лицензии');
  r = await call('/v1/claim', { transaction_id: 'txn_wait' });
  check(r.status === 404, 'сервер: неоплаченный заказ кода не даёт');
  for (const p of ['/', '/buy', '/restore', '/terms', '/refund', '/privacy']) {
    const pg = await fetch(apiUrl + p);
    check(pg.status === 200 && (await pg.text()).includes('Paddle'), `сайт: страница ${p}`);
  }
  r = await call('/v1/license', { license: GOOD });
  check(r.status === 200 && r.data.limit === 60, 'сервер: верный код принят');
  r = await call('/v1/translate', { license: GOOD, texts: ['Hello there'], target: 'ru' });
  check(r.data.translations?.[0]?.text === '[RU] Hello there', 'сервер: перевод работает');
  r = await call('/v1/translate', { license: GOOD, texts: ['x'.repeat(100)], target: 'ru' });
  check(r.status === 429, 'сервер: месячный лимит соблюдается');

  // Через расширение
  const { chromium } = createRequire(import.meta.url)('playwright');
  const ext = path.join(root, 'extension');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-pro-')), {
    channel: 'chromium', headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  const opt = await ctx.newPage();
  await opt.goto(`chrome-extension://${id}/options/options.html`);
  await opt.evaluate((u) => new Promise((r) => chrome.runtime.sendMessage({ type: 'saveSettings', patch: { proApi: u } }, r)), apiUrl);
  await opt.reload();
  await opt.selectOption('#provider', 'pro');
  check(await opt.isVisible('#buyPro'), 'настройки: видно кнопку «Купить Pro»');
  await opt.fill('#key-pro', 'BAD');
  await opt.click('#checkPro');
  await opt.waitForFunction(() => document.getElementById('proStatus').className === 'err');
  check(true, `настройки: неверный код — «${await opt.textContent('#proStatus')}»`);
  await opt.fill('#key-pro', GOOD);
  await opt.click('#checkPro');
  await opt.waitForFunction(() => document.getElementById('proStatus').className === 'ok');
  check(true, `настройки: «${await opt.textContent('#proStatus')}»`);
  await ctx.close();
} catch (e) {
  console.error('✗ тест упал:', e); failed++;
} finally {
  fake.close(); api.close();
}
console.log(failed ? `\nПровалено: ${failed}` : '\nВсе проверки Pro пройдены');
process.exit(failed ? 1 : 0);
