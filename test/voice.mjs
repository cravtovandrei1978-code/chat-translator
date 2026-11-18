// Тест голосового ввода панели: подменяем распознавание речи «фальшивым»
// и проверяем, что сказанное попадает в поле и уходит на перевод.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (f) => fs.readFileSync(path.join(root, 'extension', 'content', f), 'utf8');

let failed = 0;
const check = (cond, name) => {
  console.log(`${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failed++;
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.evaluate(() => {
    window.recs = [];
    window.webkitSpeechRecognition = class {
      constructor() { window.recs.push(this); }
      start() { this.started = true; }
      stop() { this.onend && this.onend(); }
      say(text, isFinal) {
        const res = [{ transcript: text }];
        res.isFinal = isFinal;
        this.onresult({ results: [res] });
      }
    };
    window.SpeechRecognition = undefined;
    window.translated = [];
  });
  await page.addScriptTag({ content: src('namespace.js') });
  await page.addScriptTag({ content: src('ui.js') });
  await page.evaluate(() => {
    window.panel = window.ChatTranslator.createPanel({
      onTranslate: async (t) => window.translated.push(t),
      onToggle() {}, onReplyLangChange() {}, onSettings() {}, onPick() {},
      getSpeechLang: () => 'ru',
    });
  });
  const panel = page.locator('#chat-translator-panel');
  const mic = panel.locator('[data-el="mic"]');
  check(await mic.isVisible(), 'голос: кнопка 🎤 видна');
  await mic.click();
  const lang = await page.evaluate(() => window.recs[0].lang);
  check(lang === 'ru-RU', `голос: распознаём по-русски (${lang})`);
  check(await mic.evaluate((b) => b.classList.contains('on')), 'голос: кнопка горит, пока слушаем');
  await page.evaluate(() => window.recs[0].say('привет как', false));
  check((await panel.locator('textarea').inputValue()) === 'привет как', 'голос: текст появляется в поле сразу');
  await page.evaluate(() => { window.recs[0].say('привет как дела', true); window.recs[0].onend(); });
  await page.waitForFunction(() => window.translated.length === 1);
  check(await page.evaluate(() => window.translated[0]) === 'привет как дела', 'голос: после паузы сказанное ушло на перевод');
  check(!(await mic.evaluate((b) => b.classList.contains('on'))), 'голос: кнопка погасла');

  await page.evaluate(() => (window.panel.clearInput(), 0));
  await mic.click();
  await page.evaluate(() => { const r = window.recs[1]; r.onerror({ error: 'not-allowed' }); r.onend(); });
  const st = await panel.locator('[data-el="status"]').textContent();
  check(st.includes('Разрешить'), `голос: понятная подсказка, если нет доступа к микрофону`);
  check(await page.evaluate(() => window.translated.length) === 1, 'голос: при ошибке ничего не отправлено');
} catch (e) {
  console.error('✗ тест упал:', e);
  failed++;
} finally {
  await browser.close();
}
console.log(failed ? `\nПровалено проверок: ${failed}` : '\nВсе проверки пройдены');
process.exit(failed ? 1 : 0);
