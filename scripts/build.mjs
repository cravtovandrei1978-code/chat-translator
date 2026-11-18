// Сборка zip-архивов расширения.
//   node scripts/build.mjs          → dist/chat-translator-store-<версия>.zip  (для Chrome Web Store)
//                                      dist/chat-translator-full-<версия>.zip   (всё, включая Chaturbate, для ручной установки)
// Версия для магазина: без Chaturbate и без тестовых адресов localhost/127.0.0.1.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'extension');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));

const VARIANTS = {
  store: {
    dropMatches: [/chaturbate\.com/, /localhost/, /127\.0\.0\.1/],
    dropFiles: ['content/adapters/chaturbate.js'],
    description: 'Переводит сообщения в веб-мессенджерах (WhatsApp, Telegram, Discord и любой сайт) и помогает ответить на языке собеседника.',
  },
  full: { dropMatches: [], dropFiles: [], description: manifest.description },
};

fs.rmSync(dist, { recursive: true, force: true });
for (const [name, v] of Object.entries(VARIANTS)) {
  const out = path.join(dist, name);
  fs.cpSync(src, out, { recursive: true });
  v.dropFiles.forEach((f) => fs.rmSync(path.join(out, f)));
  const m = structuredClone(manifest);
  m.description = v.description;
  for (const cs of m.content_scripts) {
    cs.matches = cs.matches.filter((u) => !v.dropMatches.some((re) => re.test(u)));
    cs.js = cs.js.filter((f) => !v.dropFiles.includes(f));
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  const zip = path.join(dist, `chat-translator-${name}-${m.version}.zip`);
  execFileSync('zip', ['-qr', zip, '.'], { cwd: out });
  console.log('✓', path.relative(root, zip));
}
