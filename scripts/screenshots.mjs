// Скриншоты 1280×800 для Chrome Web Store (на тестовых копиях чатов, без настоящих переписок).
// node scripts/screenshots.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ext = path.join(root, 'extension');
const out = path.join(root, 'store', 'screenshots');

// Настоящие переводы для подмены меток [RU] тестового провайдера
const RU = {
  'Hey! Are you free tonight?': 'Привет! Ты сегодня вечером свободна?',
  'Great, see you at 8 then': 'Отлично, тогда увидимся в 8',
  'Did you get my photo?': 'Ты получила моё фото?',
  'Hello from Telegram!': 'Привет из Telegram!',
  'Do you like the new photos?': 'Тебе нравятся новые фото?',
  'Sam Good morning!': 'Сэм: Доброе утро!',
  'Sam Are you there?': 'Сэм: Ты здесь?',
  'Sam Let me know when you are free': 'Сэм: Дай знать, когда освободишься',
};

const srv = http.createServer((req, res) => {
  const name = req.url.startsWith('/telegram') ? 'mock-telegram.html' : req.url.startsWith('/generic') ? 'mock-generic.html' : 'mock-whatsapp.html';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(root, 'test', name)));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/`;
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ct-shot-')), {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
await sw.evaluate(() => chrome.storage.local.set({ settings: { provider: 'test', translit: true } }));

async function prettify(page, preview) {
  // убираем тестовые кнопки и битую картинку
  await page.evaluate(() => {
    document.querySelectorAll('#add, #side br').forEach((e) => e.remove());
    document.querySelectorAll('img[alt="photo"]').forEach((i) => {
      const d = document.createElement('div');
      d.style.cssText = 'width:160px;height:100px;border-radius:6px;background:linear-gradient(135deg,#9ec5fe,#f6c4d8)';
      i.replaceWith(d);
    });
  });
  await page.evaluate(
    ({ RU, preview }) => {
      document.querySelectorAll('.ct-tr').forEach((e) => {
        const src = e.textContent.replace(/^\[RU\] /, '');
        e.textContent = RU[src] || src;
      });
      if (preview) {
        const p = document.querySelector('#chat-translator-panel').shadowRoot;
        p.querySelector('[data-el="preview"]').textContent = preview.preview;
        p.querySelector('[data-el="status"]').textContent = preview.status;
        p.querySelector('[data-el="langInfo"]').textContent = 'RU → EN (авто)';
      }
    },
    { RU, preview }
  );
}

// 1. WhatsApp-подобный чат + ответ
let page = await ctx.newPage();
await page.goto(base + 'whatsapp');
await page.evaluate(() => window.addMessage('Did you get my photo?'));
await page.waitForFunction(() => document.querySelectorAll('.ct-tr').length === 3);
const field = 'footer [contenteditable]';
await page.evaluate((f) => (document.querySelector(f).textContent = 'Yes, I got it! You look great 😊'), field);
await prettify(page, { preview: 'Yes, I got it! You look great 😊', status: 'Вставлено (EN). Проверь и нажми «Отправить» в чате.' });
await page.evaluate(() => {
  const p = document.querySelector('#chat-translator-panel').shadowRoot;
  p.querySelector('textarea').value = 'Да, получила! Ты отлично выглядишь 😊';
});
await page.screenshot({ path: path.join(out, '1-chat.png') });

// 2. Telegram
page = await ctx.newPage();
await page.goto(base + 'telegram');
await page.waitForFunction(() => document.querySelectorAll('.ct-tr').length === 2);
await page.evaluate(() => (document.querySelector('.input-message-input').textContent = 'Yes, I really like them'));
await prettify(page, { preview: 'Понял как: «да, очень нравится»\nYes, I really like them', status: 'Написано транслитом: «da, o4eni nravitsea». Вставлено (EN).' });
await page.screenshot({ path: path.join(out, '2-telegram-translit.png') });

// 3. Любой сайт
page = await ctx.newPage();
await page.goto(base + 'generic');
const panel = page.locator('#chat-translator-panel');
await panel.locator('[data-el="pick"]').click();
await page.click('#list > div:nth-child(2) span');
await page.waitForFunction(() => document.querySelectorAll('.ct-tr').length === 3);
await prettify(page, { preview: '', status: 'Готово: нашёл сообщений — 3. Перевожу последние.' });
await page.screenshot({ path: path.join(out, '3-any-site.png') });

await ctx.close();
srv.close();
console.log('✓ store/screenshots/*.png');
