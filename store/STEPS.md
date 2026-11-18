# Публикация в Chrome Web Store — шаги и готовые тексты

Файлы лежат в папке `E:\Claude\chat-translator`.

## 1. Аккаунт (вкладка Account / Settings)
- Publisher name: `Chat Translator`
- Contact email: твоя почта → нажать **Verify** → открыть письмо и подтвердить.
- Остальное можно не заполнять.

## 2. Новый товар
**Items → + New item** → выбрать файл `dist\chat-translator-store-0.2.0.zip`.

## 3. Вкладка Store listing (копируй по строкам)
- Description (полное описание): весь блок «Full description (EN)» из `store\listing.md` (можно добавить ниже и русский блок).
- Category: **Communication**
- Language: **English** (позже можно добавить Russian)
- Store icon: `extension\icons\icon128.png`
- Screenshots: три файла из `store\screenshots\`
- Small promo tile: `store\promo-small-440x280.png`
- Homepage / Support URL: можно оставить пустым.

## 4. Вкладка Privacy
**Single purpose:**
```
Translates chat messages on web messengers and helps the user reply in the contact's language.
```

**storage:**
```
Stores the user's settings, the translation API key and a local cache of translations in the browser.
```

**scripting:**
```
When the user clicks "Enable on this site" in the popup, the extension registers its content script for that one site so messages there can be translated.
```

**activeTab:**
```
Lets the popup check whether translation is running on the current tab and turn it on for that tab after the user clicks.
```

**Host permissions:**
```
web.whatsapp.com, web.telegram.org and discord.com: read incoming chat messages to show the translation under them and insert the translated reply into the chat box. api-free.deepl.com, api.deepl.com, translation.googleapis.com, api.anthropic.com: send text to the translation service chosen by the user. Other sites are optional and requested only when the user turns the extension on for a specific site.
```

**Remote code:** выбрать **No, I am not using remote code**.

**Data usage** — отметить галочку только:
- ☑ **Website content** (текст сообщений отправляется в выбранный сервис перевода)

И поставить все три галочки внизу («I do not sell…», «I do not use… unrelated…», «I do not use… creditworthiness…»).

**Privacy policy URL:** ссылка на страницу политики (см. сообщение в чате).

## 5. Вкладка Distribution
- Free, Visibility: **Public**, Regions: All.

## 6. Submit for review
Кнопка **Submit for review** справа вверху. Проверка обычно занимает от 1 дня до 2–3 недель.
