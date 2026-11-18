# Сервер Chat Translator Pro

Cloudflare Worker. Продажа через Paddle (выплаты на Payoneer), перевод через наш ключ DeepL.
Ключ DeepL и ключ Paddle хранятся только на сервере, в расширение не попадают.

Сайт на этом же сервере (его проверяет Paddle): `/` цены, `/buy` оплата и код лицензии,
`/restore` восстановление кода по номеру заказа, `/terms`, `/refund`, `/privacy`.

Код лицензии = `<id подписки Paddle>.<подпись>`. Хранить коды не нужно, подписка
проверяется в Paddle раз в час.

## Запуск (один раз)
```
npx wrangler login
npx wrangler kv namespace create USAGE     # вписать id в wrangler.toml
npx wrangler secret put DEEPL_KEY
npx wrangler secret put PADDLE_API_KEY
npx wrangler secret put LICENSE_SECRET     # любая длинная случайная строка
# в wrangler.toml вписать PADDLE_CLIENT_TOKEN, PADDLE_PRICE_ID, SELLER_NAME
npx wrangler deploy
```
После деплоя адрес вида `https://chat-translator-pro.<имя>.workers.dev` вписать
в `extension/background/config.js` (PRO_API) и в `host_permissions` манифеста.

## API
- `POST /v1/claim` `{transaction_id}` → `{license}` (только для оплаченных заказов)
- `POST /v1/license` `{license}` → `{ok, used, limit}`
- `POST /v1/translate` `{license, texts[], target, source}` → `{translations:[{text,src}], used, limit}`
- 401 — неверный код или подписка закончилась, 429 — месячный лимит.
