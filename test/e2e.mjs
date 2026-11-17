// Автотест: запускает Chromium с расширением, открывает тестовую копию чата
// и проверяет перевод входящих и вставку ответа. Работает без ключей
// (используется провайдер «Проверка», который не ходит в интернет).
//
// Запуск: node test/e2e.mjs            (нужен установленный playwright)
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extPath = path.join(root, 'extension');
const server = http.createServer((req, res) => {
  const name = req.url.startsWith('/whatsapp') ? 'mock-whatsapp.html' : 'mock-chaturbate.html';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(root, 'test', name)));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-e2e-'));
const ctx = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
});

let failed = 0;
const check = (cond, name) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failed++;
};

try {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];

  // Включаем тестовый провайдер через страницу настроек (как сделал бы человек)
  const opt = await ctx.newPage();
  await opt.goto(`chrome-extension://${extId}/options/options.html`);
  await opt.selectOption('#provider', 'test');
  await opt.click('#test');
  await opt.waitForFunction(() => document.getElementById('status').textContent.startsWith('Работает'));
  check(true, 'настройки: провайдер сохранён и проверка перевода работает');
  check(
    (await opt.textContent('#status')).includes('[RU] Hello'),
    'настройки: пробный перевод вернул результат'
  );
  await opt.close();

  for (const mode of ['contenteditable', 'textarea']) {
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && console.log('  console:', m.text()));
    await page.goto(base + (mode === 'textarea' ? '?input=textarea' : ''));

    await page.waitForSelector('.ct-tr', { timeout: 5000 });
    const trs = await page.$$eval('.ct-tr', (els) => els.map((e) => e.textContent));
    check(trs.includes('[RU] Hi beautiful, how are you doing today?'), `${mode}: старое сообщение переведено`);
    check(trs.length === 2, `${mode}: эмодзи и уведомления не переводятся (переводов: ${trs.length})`);

    // новое входящее сообщение
    await page.evaluate(() => window.addMessage('carlos', '¿Hablas español?'));
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.ct-tr')].some((e) => e.textContent === '[RU] ¿Hablas español?')
    );
    check(true, `${mode}: новое сообщение переведено под оригиналом`);

    // перевод стоит сразу после текста сообщения
    const placed = await page.evaluate(() => {
      const last = [...document.querySelectorAll('[data-testid="chat-message"]')].pop();
      const t = last.querySelector('[data-testid="chat-message-text"]');
      return t.nextElementSibling && t.nextElementSibling.classList.contains('ct-tr');
    });
    check(placed, `${mode}: перевод вставлен сразу после текста`);

    // ответ по-русски
    const panel = page.locator('#chat-translator-panel');
    await panel.locator('textarea').fill('Привет, спасибо!');
    await panel.locator('button.main').click();
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="chat-input"]');
      return (el.isContentEditable ? el.textContent : el.value).length > 0;
    });
    const inserted = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="chat-input"]');
      return { text: el.isContentEditable ? el.textContent : el.value, events: window.inputEvents };
    });
    check(inserted.text === '[EN] Привет, спасибо!', `${mode}: ответ вставлен в поле чата («${inserted.text}»)`);
    check(inserted.events > 0, `${mode}: сайт получил событие input`);
    const sentCount = await page.$$eval('[data-testid="chat-message"]', (e) => e.length);
    check(sentCount === 5, `${mode}: сообщение не отправлено автоматически`);

    // выключение перевода
    await panel.locator('[data-el="power"]').click();
    await page.waitForFunction(() => document.documentElement.classList.contains('ct-off'));
    await page.evaluate(() => window.addMessage('bob', 'Can you dance for me?'));
    await page.waitForTimeout(600);
    const afterOff = await page.$$eval('.ct-tr', (els) => els.some((e) => e.textContent.includes('dance')));
    check(!afterOff, `${mode}: при выключении новые сообщения не переводятся`);
    await panel.locator('[data-el="power"]').click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.ct-tr')].some((e) => e.textContent.includes('dance'))
    );
    check(true, `${mode}: после включения перевод догоняет`);

    await page.screenshot({ path: path.join(root, 'test', `screenshot-${mode}.png`) });
    await page.close();
  }

  // WhatsApp Web
  {
    const page = await ctx.newPage();
    await page.goto(base + 'whatsapp');
    await page.waitForSelector('.ct-tr', { timeout: 5000 });
    await page.waitForTimeout(300);
    const trs = await page.$$eval('.ct-tr', (els) => els.map((e) => e.textContent));
    check(
      trs.length === 2 && trs.includes('[RU] Hey! Are you free tonight?') && trs.includes('[RU] Great, see you at 8 then'),
      `whatsapp: переведены только входящие текстовые (переводов: ${trs.length})`
    );
    const outTr = await page.$$eval('.message-out .ct-tr', (e) => e.length);
    check(outTr === 0, 'whatsapp: свои сообщения не переводятся');
    await page.evaluate(() => window.addMessage('Did you get my photo?'));
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.ct-tr')].some((e) => e.textContent === '[RU] Did you get my photo?')
    );
    check(true, 'whatsapp: новое входящее переведено');
    const panel = page.locator('#chat-translator-panel');
    await panel.locator('textarea').fill('Да, получила');
    await panel.locator('button.main').click();
    await page.waitForFunction(() => document.querySelector('footer [contenteditable]').textContent.length > 0);
    const txt = await page.textContent('footer [contenteditable]');
    check(txt === '[EN] Да, получила', `whatsapp: ответ вставлен в поле внизу («${txt}»)`);
    await page.screenshot({ path: path.join(root, 'test', 'screenshot-whatsapp.png') });
    await page.close();
  }

  // кэш
  const opt2 = await ctx.newPage();
  await opt2.goto(`chrome-extension://${extId}/options/options.html`);
  await opt2.waitForFunction(() => /^\d+$/.test(document.getElementById('cacheSize').textContent));
  const size = Number(await opt2.textContent('#cacheSize'));
  check(size > 0, `кэш: сохранено переводов — ${size}`);
  await opt2.click('#clearCache');
  await opt2.waitForFunction(() => document.getElementById('cacheSize').textContent === '0');
  check(true, 'кэш: очистка работает');
} catch (e) {
  console.error('✗ тест упал:', e);
  failed++;
} finally {
  await ctx.close();
  server.close();
}

console.log(failed ? `\nПровалено проверок: ${failed}` : '\nВсе проверки пройдены');
process.exit(failed ? 1 : 0);
