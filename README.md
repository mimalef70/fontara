![](https://mimalef70.github.io/fontara/images/demo/logo.svg)

# FontARA Version 4.3

![](https://mimalef70.github.io/fontara/images/demo/screens/Version4.jpg)

![](https://mimalef70.github.io/fontara/images/demo/screens/Banner1.jpg)
![](https://mimalef70.github.io/fontara/images/demo/screens/Banner2.jpg)
![](https://mimalef70.github.io/fontara/images/demo/screens/Banner3.jpg)
![](https://mimalef70.github.io/fontara/images/demo/screens/Banner4.jpg)
![](https://mimalef70.github.io/fontara/images/demo/screens/Banner5.jpg)

Are you bored of seeing the same fonts all the time? Well, we have a way of changing the font on **almost any website** to a custom one of your own choosing. With installing **FontARA**, you can change the font on most popular sites such as ChatGPT, Google, Gmail, YouTube, X, LinkedIn, Instagram, Facebook, GitHub, or **almost any other site**.

Have fun experimenting with different fonts and settings with your browser. Find something that suits your personality and make your browser your own.

---

### Features

- Experience new web surfing with a brand new view for **Right-to-Left Languages** on the internet especially for **Persian (فارسی)** users
- Support **almost All Languages** including **Right-to-Left Languages** such as **Kurdish** **(کوردی)**, **Arabic** **(العَرَبِيَّة‎)**, **Dari Persian** **(فارسی دری)**, etc.
- Support **adding UNLIMITED Favorite Font-face** for providing a perfect view in any issues with the built-in Fonts
- **Built-in support** for popular AI tools, social apps, productivity tools, and famous sites such as **ChatGPT**, **Claude**, **Gemini**, **Copilot**, **Perplexity**, **Poe**, **OpenRouter**, **DeepSeek**, **Qwen**, **NotebookLM**, **AI Studio**, **Arena**, **Google**, **YouTube**, **Gmail**, **X**, **LinkedIn**, **Instagram**, **Facebook**, **GitHub**, **WhatsApp**, **Telegram**, **Slack**, **Trello**, **Wikipedia**, **DuckDuckGo**, **Medium**, **Goodreads**, **Dropbox**, and more.
- **Global support** for personalizing sites which are not included in the built-in list
- It is completely [**Open Source**](https://github.com/mimalef70/fontara)
- It is **Free of Charge**

---

### Download Links

<a href="https://chrome.google.com/webstore/detail/dcjdhicepiklefpimapdkbaeoocniemc/"><img src="https://mimalef70.github.io/fontara/images/demo/browsers/chrome.svg" alt="Google Chrome" width="45" /></a>
<a href="https://addons.mozilla.org/en-US/firefox/addon/fontara-font-changer/"><img src="https://mimalef70.github.io/fontara/images/demo/browsers/firefox.svg" alt="Mozilla Firefox" width="45" /></a>
<a href="https://addons.opera.com/en/extensions/details/fontara-font-changer/"><img src="https://mimalef70.github.io/fontara/images/demo/browsers/opera.svg" alt="Opera" width="45" /></a>
<a href="#"><img src="https://mimalef70.github.io/fontara/images/demo/browsers/safari.svg" alt="Safari" width="45" /></a>
<a href="#"><img src="https://mimalef70.github.io/fontara/images/demo/browsers/microsoft-edge.svg" alt="Microsoft Edge" width="45" /></a>

---

### Contacts

- [**FontARA on GitHub**](https://github.com/mimalef70/fontara)
- [**Mostafa Alahyari on X**](https://x.com/mimalef70)
- [**For More Details**](https://mimalef70.github.io/fontara/)

---

### Acknowledgment:

I would like to thank [Mr. Saber Rastikerdar](https://rastikerdar.github.io/), [Mr. Saleh Suzanchi](https://github.com/zoghal), and [Mr. Amin Abedi](https://www.opentypeshop.com/) who assisted me with giving permission to use their fonts in this extension.

I would like to thank all friends and fans for their kind support of the project.

---

### Contributing

We welcome contributions! Check our [Contributing Guidelines](CONTRIBUTING.md) to get started.

### Development

FontARA is now built as a pure WebExtension. The source manifest files live in `src/manifest*.json`, runtime code is split across `src/background`, `src/inject`, `src/ui`, `src/config`, and `src/utils`, and the build pipeline lives in `tasks`.

- Use Node.js 24 LTS and pnpm 11.
- `pnpm dev` builds and watches the Chrome MV3 debug extension in `build/chrome-mv3-dev`.
- `pnpm build` builds and packages Chrome MV3 in `build/chrome-mv3-prod.zip`.
- `pnpm build:all` builds and packages all configured MV3 targets.
- `pnpm test` runs the unit tests.

#### Google Fonts catalog

The extension ships a generated Google Fonts catalog, so normal builds do not
need a Google API key. To refresh that catalog from Google Fonts Developer API
v1, provide the key through your shell, a CI secret, or a local gitignored
`.env.local` file:

```bash
GOOGLE_FONTS_API_KEY="your-key" pnpm generate:google-fonts
```

For local development, copy `.env.example` to `.env.local` and fill the key.
Never commit a real Google API key. Runtime font loading uses the public CSS2
endpoint for the selected font only.
