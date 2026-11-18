# Тексты для страницы в Chrome Web Store

## Название
Chat Translator — переводчик чатов

## Краткое описание (до 132 символов)
RU: Перевод сообщений в WhatsApp, Telegram, Discord и любом веб-чате прямо под оригиналом и ответ на языке собеседника.
EN: Translate messages in WhatsApp, Telegram, Discord or any web chat right under the original and reply in your contact's language.

## Полное описание (RU)
Переписываетесь с людьми, которые говорят на другом языке? Chat Translator переводит каждое входящее сообщение прямо под оригиналом, а ответ можно написать по-русски — расширение переведёт его и вставит в поле чата. Отправку вы нажимаете сами.

Что умеет:
• Перевод входящих сообщений под оригиналом (свои сообщения и эмодзи не трогает)
• Панель ответа: пишете на своём языке, перевод вставляется в поле чата
• Язык ответа определяется автоматически по собеседнику, или выберите вручную
• Можно писать транслитом: «privet, 4to delae6i» → «привет, что делаешь»
• Кэш: одинаковые сообщения не переводятся повторно
• Сервис на выбор: DeepL, Google Cloud Translation или Claude (нужен ваш ключ API; у DeepL есть бесплатный план)

Конфиденциальность: своего сервера нет. Текст уходит только в выбранный вами сервис перевода, ключ и настройки хранятся в вашем браузере.

Готовая поддержка: WhatsApp Web, Telegram Web, Discord. На любом другом сайте с чатом (Instagram, Messenger и т.д.) перевод включается одной кнопкой: покажите кликом, где сообщения собеседника, и расширение запомнит.

## Full description (EN)
Chatting with people who speak another language? Chat Translator translates every incoming message right under the original, and lets you write your reply in your own language — it translates it and puts it into the chat box. You press Send yourself.

Features:
• Incoming messages translated under the original (your own messages and emoji are skipped)
• Reply panel: write in your language, the translation is inserted into the chat box
• Reply language detected automatically from your contact, or pick it manually
• Transliteration support for Russian typed in Latin letters
• Cache: repeated messages are not translated twice
• Choose the engine: DeepL, Google Cloud Translation or Claude (your own API key; DeepL has a free plan)

Privacy: no server of our own. Text goes only to the translation service you choose; your key and settings stay in your browser.

Built-in support: WhatsApp Web, Telegram Web, Discord. On any other chat site (Instagram, Messenger, etc.) turn it on with one click and show which messages to translate — it remembers.

## Категория
Communication / Общение

## Обоснование разрешений (поле «Permission justification»)
- storage — хранить настройки, ключ API и кэш переводов локально.
- scripting, activeTab, optional host permissions — только когда пользователь сам нажимает «Включить перевод на этом сайте», расширение запрашивает доступ к этому одному сайту и запускает на нём перевод.
- host web.whatsapp.com, web.telegram.org, discord.com — читать входящие сообщения и вставлять перевод ответа в поле чата.
- host api-free.deepl.com, api.deepl.com, translation.googleapis.com, api.anthropic.com — отправлять текст в выбранный пользователем сервис перевода.
- Удалённый код не используется.

## Единственное назначение (Single purpose)
Перевод сообщений в веб-чатах и помощь в ответе на языке собеседника.
