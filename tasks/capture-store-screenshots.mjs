#!/usr/bin/env node

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

import {
  ROOT_DIR,
  clickByTestId,
  setValueByTestId,
  uploadFilesByTestId,
  waitFor,
  withChromeProductionExtensionHarness
} from "../tests/support/browser/extension-harness.mjs"

const SCREENSHOT_VIEWPORT = { height: 800, width: 1280 }
const POPUP_VIEWPORT = { height: 600, width: 320 }
const COPY = {
  en: {
    direction: "ltr",
    familyName: "Shabnam family",
    heading: "A more readable web.",
    popupHeading: "Read the web your way.",
    description:
      "Choose a font, fine-tune each site, and make right-to-left text easier to read.",
    features: ["Custom fonts", "Per-site controls", "Smart RTL"],
    shortDescription: "Fonts and smart RTL for the web",
    popupAlt: "Actual FontAra popup"
  },
  fa: {
    direction: "rtl",
    familyName: "خانوادهٔ شبنم",
    heading: "وب را با فونت دلخواه بخوانید.",
    popupHeading: "فونت دلخواه شما، برای هر سایت",
    description:
      "فونت را انتخاب کنید، هر سایت را جدا تنظیم کنید و متن‌های راست‌به‌چپ را خواناتر ببینید.",
    features: ["فونت دلخواه", "تنظیمات هر سایت", "راست‌چین هوشمند"],
    shortDescription: "فونت دلخواه و راست‌چین هوشمند",
    popupAlt: "نمای واقعی پنجرهٔ FontAra"
  },
  ar: {
    direction: "rtl",
    familyName: "عائلة شبنم",
    heading: "اقرأ الويب بالخط الذي تختاره.",
    popupHeading: "خطوطك المفضلة، لكل موقع",
    description:
      "اختر خطًا واضبط كل موقع على حدة، مع دعم ذكي لاتجاه النصوص من اليمين إلى اليسار.",
    features: ["خطوط مخصصة", "إعدادات لكل موقع", "دعم RTL ذكي"],
    shortDescription: "خطوط أوضح ودعم RTL ذكي للويب",
    popupAlt: "نافذة FontAra الفعلية"
  }
}

function parseLanguages(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--all")) {
    return Object.keys(COPY)
  }
  if (args.length === 1 && args[0].startsWith("--language=")) {
    const language = args[0].slice("--language=".length)
    if (Object.hasOwn(COPY, language)) return [language]
  }
  throw new Error("Use --all or --language=en|fa|ar.")
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]
  })
}

async function waitForReady(page, language) {
  await page.bringToFront()
  await page.waitForFunction(
    (expectedLanguage) =>
      document.documentElement.lang === expectedLanguage &&
      document.documentElement.dir ===
        (expectedLanguage === "en" ? "ltr" : "rtl"),
    {},
    language
  )
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  )
}

async function waitForOptionsReady(page, language) {
  await waitFor(
    () =>
      page
        .evaluate(
          () =>
            document
              .querySelector("#fontara-options-panel")
              ?.getAttribute("aria-busy") === "false"
        )
        .catch(() => false),
    { message: "The FontAra options page did not finish loading." }
  )
  await waitForReady(page, language)
}

async function captureOptionsSection(page, language, section, filePath) {
  await clickByTestId(page, `fontara-options-nav-${section}`)
  if (section === "sites") {
    await clickByTestId(page, "fontara-sites-tab-profiles")
    await page.waitForSelector(
      '[data-testid="fontara-site-profile-row-example.org"]'
    )
  }
  if (section === "fonts") {
    await page.$eval('[data-testid="fontara-custom-font-form"]', (element) => {
      window.scrollTo({
        behavior: "instant",
        top: window.scrollY + element.getBoundingClientRect().top - 112
      })
    })
  } else {
    await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }))
  }
  await waitForOptionsReady(page, language)
  await page.bringToFront()
  await page.screenshot({ path: filePath, type: "png" })
}

async function seedCustomFontFamily(page, language) {
  await clickByTestId(page, "fontara-options-nav-fonts")
  await setValueByTestId(
    page,
    "fontara-custom-font-name",
    COPY[language].familyName
  )
  await uploadFilesByTestId(page, "fontara-custom-font-regular-file", [
    path.join(ROOT_DIR, "assets/fonts/shabnam/Shabnam.woff2")
  ])
  await page.waitForSelector(
    '[data-testid="fontara-custom-font-regular-ready"]'
  )
  await uploadFilesByTestId(page, "fontara-custom-font-bold-file", [
    path.join(ROOT_DIR, "assets/fonts/shabnam/Shabnam-Bold.woff2")
  ])
  await page.waitForSelector('[data-testid="fontara-custom-font-bold-ready"]')
  await waitFor(
    () =>
      page.$eval(
        '[data-testid="fontara-custom-font-add"]',
        (element) => element instanceof HTMLButtonElement && !element.disabled
      ),
    { message: "The screenshot custom-font family was not validated." }
  )
  await clickByTestId(page, "fontara-custom-font-add")
  await waitFor(
    () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            chrome.storage.local.get("customFontList", (values) => {
              const families = values.customFontList
              resolve(
                Array.isArray(families) && families[0]?.faces?.length === 2
              )
            })
          })
      ),
    { message: "The screenshot custom-font family was not committed." }
  )
  // Dismiss the upload confirmation through its real UI control.
  await page
    .$eval("[toast-close]", (element) => {
      if (element instanceof HTMLButtonElement) element.click()
    })
    .catch(() => {})
  await page.waitForSelector("[toast-close]", { hidden: true })
}

async function activateFixtureTab(extensionPage, fixturePrefix) {
  await extensionPage.evaluate(
    (prefix) =>
      new Promise((resolve, reject) => {
        chrome.tabs.query({}, (tabs) => {
          const error = chrome.runtime.lastError
          if (error) return reject(new Error(error.message))
          const fixture = tabs.find((tab) => tab.url?.startsWith(prefix))
          if (typeof fixture?.id !== "number")
            return reject(
              new Error("The screenshot fixture tab was not found.")
            )
          chrome.tabs.update(fixture.id, { active: true }, () => {
            const updateError = chrome.runtime.lastError
            if (updateError) reject(new Error(updateError.message))
            else resolve(true)
          })
        })
      }),
    fixturePrefix
  )
}

async function capturePopup(harness, optionsPage, language) {
  // Serve a local demonstration under the reserved example.org domain so the
  // real popup uses a readable, stable tab context without implying a real site.
  const fixturePage = await harness.browser.newPage()
  await fixturePage.setRequestInterception(true)
  fixturePage.on("request", (request) => {
    if (request.url().startsWith("https://example.org/")) {
      void request.respond({
        body: "<!doctype html><html lang='en'><meta charset='utf-8'><title>FontAra local example</title><body><main><h1>FontAra local example</h1><p>This locally served page supplies context for a screenshot of the real extension popup.</p></main></body></html>",
        contentType: "text/html; charset=utf-8",
        status: 200
      })
    } else {
      void request.continue()
    }
  })
  await fixturePage.goto("https://example.org/", { waitUntil: "load" })
  const popupPage = await harness.createExtensionPage("ui/popup/index.html", {
    viewport: POPUP_VIEWPORT
  })
  try {
    await activateFixtureTab(optionsPage, "https://example.org/")
    await popupPage.reload({ waitUntil: "load" })
    await popupPage.waitForSelector(
      '[data-testid="fontara-font-selector-trigger"]'
    )
    await waitForReady(popupPage, language)
    return await popupPage.screenshot({ type: "png" })
  } finally {
    await popupPage.close()
    await fixturePage.close()
  }
}

function compositionHTML({ language, kind, icon, font, popup }) {
  const copy = COPY[language]
  const small = kind === "small-promo"
  const marquee = kind === "marquee"
  const width = small ? 440 : marquee ? 1400 : 1280
  const height = small ? 280 : marquee ? 560 : 800
  const heading = kind === "popup" ? copy.popupHeading : copy.heading
  return `<!doctype html>
  <html lang="${language}" dir="${copy.direction}">
  <head><meta charset="utf-8"><style>
    @font-face { font-family: StoreFont; src: url(data:font/woff2;base64,${font}); font-weight: 100 900; }
    * { box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; }
    body { font-family: StoreFont, sans-serif; color: #0b1740;
      background: radial-gradient(ellipse at 0% 0%, #ffffff 0%, transparent 55%),
                  radial-gradient(ellipse at 100% 100%, #d8e6ff 0%, transparent 55%), #edf3ff; }
    .layout { height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 360px;
      gap: 76px; padding: 64px 100px; align-items: center; }
    .brand { display: flex; align-items: center; gap: 18px; margin-bottom: 42px; }
    .brand img { width: 76px; height: 76px; }
    .brand strong { font-size: 46px; font-weight: 800; letter-spacing: -1.5px; }
    h1 { max-width: 640px; margin: 0; font-size: 48px; font-weight: 800; line-height: 1.4; }
    p { max-width: 610px; margin: 24px 0 0; font-size: 23px; line-height: 1.85; color: #465676; }
    .features { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
    .features span { padding: 10px 16px; border: 1px solid #ccd9f4; border-radius: 999px;
      background: #ffffffa8; color: #2459be; font-size: 15px; font-weight: 600; }
    .popup-shell { display: flex; padding: 16px; width: 354px; border-radius: 28px;
      background: #ffffff; border: 1px solid #d5dff3; box-shadow: 0 30px 70px -20px #324e8950; }
    .popup-shell img { display: block; width: 320px; height: 600px; border-radius: 16px; }
    .marquee .layout { grid-template-columns: minmax(0, 1fr) 280px; padding: 46px 116px; gap: 90px; }
    .marquee .brand { margin-bottom: 22px; }
    .marquee .brand img { width: 66px; height: 66px; }
    .marquee .brand strong { font-size: 42px; }
    .marquee h1 { font-size: 48px; }
    .marquee .features { margin-top: 26px; }
    .marquee .popup-shell { width: 258px; padding: 12px; border-radius: 22px; }
    .marquee .popup-shell img { width: 232px; height: 435px; border-radius: 12px; }
    .small-promo .layout { display: flex; flex-direction: column; gap: 0; justify-content: center; padding: 28px; text-align: center; }
    .small-promo .brand { margin-bottom: 22px; gap: 13px; }
    .small-promo .brand img { width: 60px; height: 60px; }
    .small-promo .brand strong { font-size: 40px; }
    .small-promo h1 { max-width: 370px; font-size: 23px; line-height: 1.65; font-weight: 700; }
    .small-promo .features { justify-content: center; margin-top: 16px; gap: 8px; }
    .small-promo .features span { font-size: 12px; padding: 5px 10px; }
  </style></head>
  <body class="${kind}"><main class="layout"><section>
    <div class="brand"><img alt="" src="data:image/png;base64,${icon}"><strong dir="ltr">FontAra</strong></div>
    <h1>${escapeHTML(small ? copy.shortDescription : heading)}</h1>
    ${small || marquee ? "" : `<p>${escapeHTML(copy.description)}</p>`}
    <div class="features">${copy.features.map((feature) => `<span>${escapeHTML(feature)}</span>`).join("")}</div>
  </section>${small ? "" : `<aside class="popup-shell"><img alt="${escapeHTML(copy.popupAlt)}" src="data:image/png;base64,${popup}"></aside>`}</main></body></html>`
}

async function captureCompositions(
  harness,
  language,
  popup,
  outputDir,
  version
) {
  const [icon, font] = await Promise.all([
    fs.readFile(path.join(ROOT_DIR, "assets/icon-128.png")),
    fs.readFile(
      path.join(ROOT_DIR, "assets/fonts/vazir/variable/Vazirmatn[wght].woff2")
    )
  ])
  const page = await harness.browser.newPage()
  try {
    for (const [kind, viewport] of [
      ["popup", SCREENSHOT_VIEWPORT],
      ["small-promo", { height: 280, width: 440 }],
      ["marquee", { height: 560, width: 1400 }]
    ]) {
      await page.setViewport(viewport)
      await page.setContent(
        compositionHTML({
          language,
          kind,
          icon: icon.toString("base64"),
          font: font.toString("base64"),
          popup: Buffer.from(popup).toString("base64")
        }),
        { waitUntil: "load" }
      )
      await waitForReady(page, language)
      const overflow = await page.evaluate(() => {
        const viewport = { width: innerWidth, height: innerHeight }
        return [
          ...document.querySelectorAll("h1, p, .brand, .features, .popup-shell")
        ]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            return (
              rect.top < 0 ||
              rect.left < 0 ||
              rect.right > viewport.width ||
              rect.bottom > viewport.height
            )
          })
          .map((element) => element.className || element.tagName)
      })
      assert.deepEqual(
        overflow,
        [],
        `Composition overflows: ${language}/${kind}`
      )
      await page.screenshot({
        path: path.join(outputDir, `fontara-${version}-${kind}.png`),
        type: "png"
      })
    }
  } finally {
    await page.close()
  }
}

async function main() {
  if (process.argv.slice(2).includes("--help")) {
    console.log(
      "Usage: node tasks/capture-store-screenshots.mjs [--all | --language=en|fa|ar]"
    )
    console.log(
      "Capture five 1280×800 screenshots, a 440×280 promo and a 1400×560 marquee per language."
    )
    return
  }
  const languages = parseLanguages(process.argv.slice(2))
  const packageJSON = JSON.parse(
    await fs.readFile(path.join(ROOT_DIR, "package.json"), "utf8")
  )
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(ROOT_DIR, "build/chrome-mv3-prod/manifest.json"),
      "utf8"
    )
  )
  const { version } = packageJSON
  assert.match(version, /^\d+\.\d+\.\d+(?:\.\d+)?$/, "Invalid package version")
  assert.equal(
    manifest.version,
    version,
    "Build the current production package before capture"
  )

  for (const language of languages) {
    const outputDir = path.join(
      ROOT_DIR,
      "docs/images/store",
      version,
      language
    )
    await fs.mkdir(outputDir, { recursive: true })
    await withChromeProductionExtensionHarness(
      {
        skip(reason) {
          throw new Error(reason)
        }
      },
      async (harness) => {
        const optionsPage = await harness.createExtensionPage(
          "ui/options/index.html",
          { viewport: SCREENSHOT_VIEWPORT }
        )
        await optionsPage.evaluate(
          (uiLanguage) =>
            new Promise((resolve, reject) => {
              chrome.storage.local.set(
                {
                  uiLanguage,
                  enabledByDefault: true,
                  siteProfiles: [
                    {
                      pattern: "example.org",
                      font: "Vazirmatn-Fontara",
                      textStroke: 0.2
                    },
                    { pattern: "example.net", font: "Shabnam-Fontara" }
                  ]
                },
                () => {
                  const error = chrome.runtime.lastError
                  if (error) reject(new Error(error.message))
                  else resolve(true)
                }
              )
            }),
          language
        )
        await optionsPage.reload({ waitUntil: "load" })
        await waitForOptionsReady(optionsPage, language)
        await seedCustomFontFamily(optionsPage, language)
        for (const [section, name] of [
          ["fonts", "custom-fonts"],
          ["general", "general"],
          ["sites", "site-profiles"],
          ["rtl", "smart-rtl"]
        ]) {
          await captureOptionsSection(
            optionsPage,
            language,
            section,
            path.join(outputDir, `fontara-${version}-${name}.png`)
          )
        }
        const popup = await capturePopup(harness, optionsPage, language)
        await captureCompositions(harness, language, popup, outputDir, version)
      }
    )
    console.log(`Captured ${language} store assets in ${outputDir}`)
  }
}

await main()
