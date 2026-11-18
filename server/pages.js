// Сайт Chat Translator Pro: главная с ценой, оплата, восстановление кода и правила.
// Paddle проверяет этот сайт перед одобрением, поэтому тут есть цена, условия,
// возвраты и политика конфиденциальности.

const PRICE = '$4.99 / month';
const STORE_URL = 'https://chromewebstore.google.com/detail/pdaagppjfdbakidpfjencjnnohdlkkam';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function layout(title, body, env, extraHead = '') {
  const seller = esc(env.SELLER_NAME || 'Chat Translator');
  const contact = esc(env.CONTACT_EMAIL || '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Chat Translator</title>
<style>
:root{--bg:#f6f8fc;--fg:#1d2433;--muted:#5b6577;--accent:#2f6fde;--card:#fff;--line:#d7deea}
@media (prefers-color-scheme:dark){:root{--bg:#121722;--fg:#e4e9f2;--muted:#9aa5b8;--accent:#7aa5f0;--card:#1a2130;--line:#2a3344}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:24px 16px 48px}
nav{display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:32px}
nav a{color:var(--muted);text-decoration:none}nav a.brand{color:var(--fg);font-weight:700;margin-right:auto}
h1{font-size:34px;line-height:1.2;margin:0 0 12px}h2{margin-top:32px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin:20px 0}
.price{font-size:28px;font-weight:700}
.btn{display:inline-block;background:var(--accent);color:#fff;border:0;border-radius:8px;padding:12px 20px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}
input{font:inherit;padding:10px;border:1px solid var(--line);border-radius:8px;width:100%;background:var(--card);color:var(--fg)}
code,.key{font-family:ui-monospace,Consolas,monospace;word-break:break-all}
.key{display:block;background:var(--bg);border:1px dashed var(--accent);padding:12px;border-radius:8px;font-size:15px}
.muted{color:var(--muted)}footer{margin-top:48px;color:var(--muted);font-size:14px}
ul{padding-left:20px}
</style>${extraHead}</head><body><div class="wrap">
<nav><a class="brand" href="/">Chat Translator</a><a href="/buy">Buy Pro</a><a href="/restore">Restore key</a><a href="/terms">Terms</a><a href="/refund">Refunds</a><a href="/privacy">Privacy</a></nav>
${body}
<footer>© ${new Date().getFullYear()} ${seller}. Payments are processed by Paddle.com, our Merchant of Record.${contact ? ` Contact: ${contact}` : ''}</footer>
</div></body></html>`;
}

const home = (env) => layout('Translate any web chat', `
<h1>Translate any web chat. Reply in their language.</h1>
<p>Chat Translator is a Chrome extension that translates incoming messages in WhatsApp Web, Telegram Web, Discord and any other web chat right under the original, and translates your reply into your contact's language.</p>
<div class="card">
  <div class="price">Free</div>
  <p>Use your own DeepL, Google Cloud or Claude API key. All features included.</p>
  <a class="btn" href="${STORE_URL}">Add to Chrome</a>
</div>
<div class="card">
  <div class="price">Pro · ${PRICE}</div>
  <ul><li>No API keys needed: paste one license key and it works</li><li>DeepL translation quality, up to ${Number(env.MONTHLY_CHARS || 500000).toLocaleString('en')} characters per month</li><li>Cancel any time</li></ul>
  <a class="btn" href="/buy">Buy Pro</a>
</div>`, env);

const buy = (env) => layout('Buy Pro', `
<h1>Chat Translator Pro</h1>
<p class="price">${PRICE}</p>
<p>After payment your license key appears on this page. Paste it in the extension: Settings → Service → Chat Translator Pro.</p>
<p><button class="btn" id="pay">Pay with card or PayPal</button></p>
<div id="done" hidden class="card"><b>Thank you! Your license key:</b><p><span class="key" id="key"></span></p>
<button class="btn" id="copy">Copy key</button><p class="muted">Keep it. If you lose it, restore it with the order number (txn_…) from the Paddle receipt email.</p></div>
<p id="msg" class="muted"></p>
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
<script>
const msg = document.getElementById('msg');
async function claim(txn) {
  for (let i = 0; i < 10; i++) {
    const r = await fetch('/v1/claim', { method: 'POST', body: JSON.stringify({ transaction_id: txn }) });
    if (r.ok) { const d = await r.json(); document.getElementById('key').textContent = d.license; document.getElementById('done').hidden = false; msg.textContent = ''; return; }
    msg.textContent = 'Confirming payment…'; await new Promise((x) => setTimeout(x, 3000));
  }
  msg.textContent = 'Payment is still processing. Open /restore later and enter the order number from your receipt: ' + txn;
}
${env.PADDLE_ENV === 'production' ? '' : "Paddle.Environment.set('sandbox');"}
Paddle.Initialize({ token: ${JSON.stringify(env.PADDLE_CLIENT_TOKEN || '')}, eventCallback: (e) => {
  if (e.name === 'checkout.completed' && e.data && e.data.transaction_id) { Paddle.Checkout.close(); claim(e.data.transaction_id); }
} });
document.getElementById('pay').onclick = () => Paddle.Checkout.open({ items: [{ priceId: ${JSON.stringify(env.PADDLE_PRICE_ID || '')}, quantity: 1 }] });
document.getElementById('copy').onclick = () => navigator.clipboard.writeText(document.getElementById('key').textContent);
</script>`, env);

const restore = (env) => layout('Restore license key', `
<h1>Restore your license key</h1>
<p>Enter the order number from your Paddle receipt email. It starts with <code>txn_</code>.</p>
<form id="f" class="card"><input id="txn" placeholder="txn_01h…" required><p><button class="btn">Show my key</button></p>
<p id="out"></p></form>
<script>
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const out = document.getElementById('out');
  const r = await fetch('/v1/claim', { method: 'POST', body: JSON.stringify({ transaction_id: document.getElementById('txn').value.trim() }) });
  if (r.ok) { const d = await r.json(); out.innerHTML = '<span class="key"></span>'; out.firstChild.textContent = d.license; }
  else out.textContent = 'No paid subscription found for this order number.';
};
</script>`, env);

const terms = (env) => layout('Terms of Service', `
<h1>Terms of Service</h1>
<p>These terms apply to Chat Translator Pro, a subscription that provides machine translation for the Chat Translator browser extension, offered by ${esc(env.SELLER_NAME || 'the developer of Chat Translator')}.</p>
<h2>Payments</h2><p>Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.</p>
<h2>Subscription</h2><p>Pro costs ${PRICE} and renews automatically each month until cancelled. You can cancel any time from the link in your Paddle receipt; access continues until the end of the paid period.</p>
<h2>Service</h2><p>Pro includes up to ${Number(env.MONTHLY_CHARS || 500000).toLocaleString('en')} translated characters per month per license. Translations are produced automatically and may contain errors. One license is for one person.</p>
<h2>Acceptable use</h2><p>Do not share your license key publicly, resell the service or use it to send spam. We may suspend keys that are abused.</p>
<h2>Liability</h2><p>The service is provided "as is". To the extent permitted by law, we are not liable for indirect damages resulting from translation errors or service interruptions.</p>`, env);

const refund = (env) => layout('Refund Policy', `
<h1>Refund Policy</h1>
<p>If you are not satisfied with Chat Translator Pro, you can request a full refund within 14 days of your first payment. Refunds are handled by Paddle.com, our Merchant of Record: reply to your receipt email or visit paddle.net to request one.</p>
<p>Renewal payments can be refunded within 14 days if you did not use the service during that period. After cancellation, no further payments are taken.</p>`, env);

const privacy = (env) => layout('Privacy Policy', `
<h1>Privacy Policy</h1>
<p><b>Free version.</b> Text is sent directly from your browser to the translation service you choose (DeepL, Google Cloud Translation or Anthropic). We do not receive it.</p>
<p><b>Pro.</b> To translate, the extension sends message text and your license key to our server, which forwards the text to DeepL and returns the translation. We do not store message text. We store only a counter of translated characters per license for the monthly limit.</p>
<p><b>Payments.</b> Payment details and your email are processed by Paddle.com as Merchant of Record under its own privacy policy. We receive your subscription status from Paddle.</p>
<p><b>Never.</b> No analytics, no advertising, no selling of data. The extension never sends messages on your behalf.</p>`, env);

const PAGES = { '/': home, '/buy': buy, '/restore': restore, '/terms': terms, '/refund': refund, '/privacy': privacy };

export function pageResponse(path, env) {
  const page = PAGES[path.replace(/\/$/, '') || '/'];
  if (!page) return new Response('Not found', { status: 404 });
  return new Response(page(env), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
