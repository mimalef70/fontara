#!/usr/bin/env node

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

const OUTPUT_DIR = path.join(ROOT_DIR, "docs/images/store/5.1.0/fa")
const SCREENSHOT_VIEWPORT = { height: 800, width: 1280 }

async function waitForOptionsReady(page) {
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
    { message: "The FontARA options page did not finish loading." }
  )
}

async function captureOptionsSection(page, section, fileName) {
  await clickByTestId(page, `fontara-options-nav-${section}`)
  if (section === "sites" && fileName.includes("site-profiles")) {
    await clickByTestId(page, "fontara-sites-tab-profiles")
  }
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }))
  await waitForOptionsReady(page)
  await page.bringToFront()
  await new Promise((resolve) => setTimeout(resolve, 250))
  await page.screenshot({
    path: path.join(OUTPUT_DIR, fileName),
    type: "png"
  })
}

async function seedCustomFontFamily(page) {
  await clickByTestId(page, "fontara-options-nav-fonts")
  await uploadFilesByTestId(page, "fontara-custom-font-file", [
    path.join(ROOT_DIR, "assets/fonts/shabnam/Shabnam.woff2"),
    path.join(ROOT_DIR, "assets/fonts/shabnam/Shabnam-Bold.woff2")
  ])
  await waitFor(
    () =>
      page.$eval(
        "[data-testid='fontara-custom-font-add']",
        (element) => element instanceof HTMLButtonElement && !element.disabled
      ),
    { message: "The screenshot custom-font family was not validated." }
  )
  await setValueByTestId(page, "fontara-custom-font-name", "خانوادهٔ شبنم")
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
}

async function activateFixtureTab(extensionPage, fixturePrefix) {
  await extensionPage.evaluate(
    (prefix) =>
      new Promise((resolve, reject) => {
        chrome.tabs.query({}, (tabs) => {
          const error = chrome.runtime.lastError
          if (error) {
            reject(new Error(error.message))
            return
          }
          const fixture = tabs.find((tab) => tab.url?.startsWith(prefix))
          if (typeof fixture?.id !== "number") {
            reject(new Error("The screenshot fixture tab was not found."))
            return
          }
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

async function capturePopupComposition(harness, optionsPage) {
  const fixturePage = await harness.browser.newPage()
  await fixturePage.setRequestInterception(true)
  fixturePage.on("request", (request) => {
    void request.respond({
      body: "<!doctype html><html lang='fa' dir='rtl'><meta charset='utf-8'><title>مطالعهٔ فارسی</title><body><main><h1>نمونهٔ متن فارسی</h1><p>این صفحهٔ محلی فقط برای ثبت تصویر رابط افزونه ساخته شده است.</p></main></body></html>",
      contentType: "text/html; charset=utf-8",
      status: 200
    })
  })
  await fixturePage.goto("https://fa.wikipedia.org/wiki/FontARA", {
    waitUntil: "load"
  })
  const popupPage = await harness.createExtensionPage(
    "ui/popup/index.html",
    { viewport: { height: 600, width: 320 } }
  )
  await activateFixtureTab(optionsPage, "https://fa.wikipedia.org/")
  await popupPage.evaluate(() => window.location.reload())
  await popupPage.waitForSelector("[data-testid='fontara-font-selector-trigger']")
  await popupPage.bringToFront()
  await new Promise((resolve) => setTimeout(resolve, 250))

  const popupPNG = await popupPage.screenshot({
    clip: { height: 600, width: 320, x: 0, y: 0 },
    type: "png"
  })
  const iconPNG = await fs.readFile(path.join(ROOT_DIR, "assets/icon-128.png"))
  const composition = await harness.browser.newPage()
  await composition.setViewport(SCREENSHOT_VIEWPORT)
  await composition.setContent(`<!doctype html>
    <html lang="fa" dir="rtl">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; }
          html, body { width: 1280px; height: 800px; margin: 0; overflow: hidden; }
          body {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 420px;
            align-items: center;
            gap: 76px;
            padding: 70px 108px;
            color: #0f172a;
            background:
              radial-gradient(circle at 15% 15%, rgba(255,255,255,.92), transparent 30%),
              linear-gradient(135deg, #dbeafe 0%, #f8fafc 52%, #e0e7ff 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .copy { direction: rtl; text-align: right; }
          .brand { display: flex; align-items: center; gap: 20px; margin-bottom: 42px; }
          .brand img { width: 92px; height: 92px; filter: drop-shadow(0 16px 28px rgba(37,99,235,.18)); }
          .brand strong { display: block; font-size: 54px; letter-spacing: -1.5px; }
          .brand span { display: block; margin-top: 5px; color: #475569; font-size: 22px; }
          h1 { max-width: 620px; margin: 0; font-size: 44px; line-height: 1.45; letter-spacing: -.8px; }
          p { max-width: 590px; margin: 22px 0 0; color: #475569; font-size: 24px; line-height: 1.8; }
          .popup-shell {
            justify-self: end;
            width: 360px;
            padding: 20px;
            border: 1px solid rgba(148,163,184,.35);
            border-radius: 24px;
            background: rgba(255,255,255,.84);
            box-shadow: 0 32px 80px rgba(15,23,42,.22);
          }
          .popup-shell img { display: block; width: 320px; height: 600px; border-radius: 12px; }
        </style>
      </head>
      <body>
        <main class="copy">
          <div class="brand">
            <img alt="" src="data:image/png;base64,${iconPNG.toString("base64")}">
            <div><strong>FontARA</strong><span>نسخهٔ ۵.۱</span></div>
          </div>
          <h1>کنترل سریع فونت و تنظیمات هر سایت</h1>
          <p>فونت‌های داخلی، دلخواه و سیستم در یک رابط ساده، سریع و حریم‌خصوصی‌محور.</p>
        </main>
        <aside class="popup-shell">
          <img alt="نمای واقعی پنجرهٔ FontARA" src="data:image/png;base64,${Buffer.from(popupPNG).toString("base64")}">
        </aside>
      </body>
    </html>`)
  await composition.screenshot({
    path: path.join(OUTPUT_DIR, "fontara-5.1-popup.png"),
    type: "png"
  })
  await composition.close()
  await popupPage.close()
  await fixturePage.close()
}

await fs.mkdir(OUTPUT_DIR, { recursive: true })

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
      () =>
        new Promise((resolve, reject) => {
          chrome.storage.local.set({ uiLanguage: "fa" }, () => {
            const error = chrome.runtime.lastError
            if (error) reject(new Error(error.message))
            else resolve(true)
          })
        })
    )
    await optionsPage.reload({ waitUntil: "load" })
    await waitForOptionsReady(optionsPage)
    await seedCustomFontFamily(optionsPage)

    await captureOptionsSection(
      optionsPage,
      "fonts",
      "fontara-5.1-custom-fonts.png"
    )
    await optionsPage
      .$eval("[toast-close]", (element) => {
        if (element instanceof HTMLButtonElement) element.click()
      })
      .catch(() => {})
    await captureOptionsSection(
      optionsPage,
      "general",
      "fontara-5.1-general.png"
    )
    await captureOptionsSection(
      optionsPage,
      "sites",
      "fontara-5.1-site-profiles.png"
    )
    await captureOptionsSection(
      optionsPage,
      "rtl",
      "fontara-5.1-smart-rtl.png"
    )
    await capturePopupComposition(harness, optionsPage)
  }
)

console.log(`Captured localized store screenshots in ${OUTPUT_DIR}`)
