// Тест Pro: поднимает сервер (worker.js) с поддельными Polar и DeepL,
// проверяет лицензию, лимит и перевод через расширение.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../server/worker.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GOOD = 'GOOD-LICENSE-KEY';
let failed = 0;
const check = (c, n) => { console.log(`${c ? '✓' : '✗'} ${n}`); if (!c) failed++; };

const listen = (h) => new Promise((r) => { const s = http.createServer(h); s.listen(0, '127.0.0.1', () => r(s)); });
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });

// Поддельные Polar и DeepL
let deeplCalls = 0;
const fake = await listen(async (req, res) => {
  const body = JSON.parse((await readBody(req)) || '{}');
  if (req.url.endsWith('/license-keys/validate')) {
    if (body.key === GOOD && body.organization_id === 'org-1') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'granted', expires_at: null }));
    }
    res.writeHead(404); return res.end('{}');
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
const env = { POLAR_API: fakeUrl, DEEPL_API: fakeUrl, DEEPL_KEY: 'SECRET', POLAR_ORG_ID: 'org-1', MONTHLY_CHARS: '60' };

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
