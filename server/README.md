# Сервер Chat Translator Pro

Cloudflare Worker. Проверяет код лицензии в Polar и переводит через наш ключ DeepL.
Ключ DeepL хранится только на сервере, в расширение не попадает.

## Запуск (один раз)
```
npx wrangler login
npx wrangler kv namespace create USAGE     # вписать id в wrangler.toml
npx wrangler secret put DEEPL_KEY          # вставить ключ DeepL API Pro
# в wrangler.toml вписать POLAR_ORG_ID
npx wrangler deploy
```
После деплоя адрес вида `https://chat-translator-pro.<имя>.workers.dev` вписать
в `extension/background/config.js` (PRO_API) и в `host_permissions` манифеста.

## API
- `POST /v1/license` `{license}` → `{ok, used, limit}`
- `POST /v1/translate` `{license, texts[], target, source}` → `{translations:[{text,src}], used, limit}`
- 401 — неверный код или подписка закончилась, 429 — месячный лимит.
