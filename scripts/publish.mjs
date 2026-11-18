// Загрузка новой версии в Chrome Web Store (API v2) и отправка на проверку.
// Запускается из GitHub Actions. Нужен секрет CWS_SERVICE_ACCOUNT — JSON-ключ
// сервисного аккаунта Google, добавленного в кабинет магазина (Account → Service account).
//   node scripts/publish.mjs dist/chat-translator-store-0.2.1.zip
import fs from 'node:fs';
import crypto from 'node:crypto';

const PUBLISHER = 'b733d783-a166-4e0d-9fb9-6cadfcc5e5f3';
const ITEM = 'pdaagppjfdbakidpfjencjnnohdlkkam';
const API = 'https://chromewebstore.googleapis.com';
const zip = process.argv[2];
const sa = JSON.parse(process.env.CWS_SERVICE_ACCOUNT || '{}');
if (!zip || !sa.private_key) {
  console.error('Нужен путь к zip и секрет CWS_SERVICE_ACCOUNT');
  process.exit(1);
}

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claim = b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/chromewebstore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claim}.${sig}`,
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(`Не удалось получить токен: ${JSON.stringify(d)}`);
  return d.access_token;
}

const t = await token();
const auth = { Authorization: `Bearer ${t}` };
const item = `${API}/v2/publishers/${PUBLISHER}/items/${ITEM}`;
const upload = `${API}/upload/v2/publishers/${PUBLISHER}/items/${ITEM}:upload`;

console.log('Загружаю', zip);
let res = await fetch(upload, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/zip' }, body: fs.readFileSync(zip) });
let d = await res.json();
console.log('upload:', JSON.stringify(d));
if (!res.ok) process.exit(1);
for (let i = 0; i < 20 && d.uploadState === 'IN_PROGRESS'; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  d = await (await fetch(`${item}:fetchStatus`, { headers: auth })).json();
  console.log('status:', JSON.stringify(d));
}
res = await fetch(`${item}:publish`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' });
d = await res.json();
console.log('publish:', JSON.stringify(d));
if (!res.ok) process.exit(1);
console.log('Отправлено на проверку в Chrome Web Store');
