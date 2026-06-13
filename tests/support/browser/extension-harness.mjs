import assert from "node:assert/strict"
import fs from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"

import puppeteer from "puppeteer-core"

export const ROOT_DIR = path.resolve(import.meta.dirname, "../../..")
export const CHROME_EXTENSION_DIR = path.join(ROOT_DIR, "build/chrome-mv3-dev")
export const FIREFOX_EXTENSION_DIR = path.join(
  ROOT_DIR,
  "build/firefox-mv3-dev"
)

export const BROWSER_VIEWPORTS = {
  mobile: { height: 844, isMobile: true, width: 390 },
  tablet: { height: 1024, width: 768 },
  desktop: { height: 900, width: 1440 },
  wide: { height: 1080, width: 1920 }
}

export const MESSAGE_TYPES_UI_TO_BG = {
  CHANGE_SETTINGS: "fontara-ui-bg-change-settings",
  GET_DATA: "fontara-ui-bg-get-data"
}

export const STORAGE_KEYS = {
  CONTEXT_MENUS_ENABLED: "contextMenusEnabled",
  CUSTOM_FONT_LIST: "customFontList",
  DISABLED_FOR: "disabledFor",
  ENABLED_BY_DEFAULT: "enabledByDefault",
  ENABLED_FOR: "enabledFor",
  EXTENSION_ENABLED: "isExtensionEnabled",
  SITE_PROFILES: "siteProfiles",
  SELECTED_FONT: "selectedFont",
  SYNC_SETTINGS: "syncSettings",
  TEXT_STROKE: "textStroke",
  WEBSITE_LIST: "websiteList"
}

export const SETTINGS_UPDATED_AT_KEY = "__fontara_settings_updated_at__"
const SETTINGS_SYNC_STORAGE_CHUNK_META_KEY = "__meta_split_count"
const FONTARA_BROWSER_TEST_PAGE_REQUEST = "fontara-browser-test-page-request"
const FONTARA_BROWSER_TEST_PAGE_RESPONSE = "fontara-browser-test-page-response"
const FONTARA_BROWSER_TEST_PAGE_PING = "fontara-browser-test-page-ping"
const EXTENSION_RUNTIME_SETTLE_MS = 250
const HARD_FIXTURE_PATH = "/hard.html"
const FRAME_FIXTURE_PATH = "/frame.html"
const CROSS_ORIGIN_FRAME_PATH = "/cross-origin-frame.html"
const CROSS_ORIGIN_FRAME_NAME = "fontara-cross-origin-frame"
const FONTARA_INLINE_FONT_MARKER = "var(--fontara-font)"
const FONTARA_FONT_FAMILY_PATTERN = /fontara/i

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function testIdSelector(testId) {
  const escapedTestId = String(testId)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
  return `[data-testid="${escapedTestId}"]`
}

function valuesAreEqual(first, second) {
  return JSON.stringify(first) === JSON.stringify(second)
}

function reassembleSyncStorageChunks(values) {
  const reassembledValues = { ...values }

  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "object" || value === null) {
      continue
    }

    const splitCount = value[SETTINGS_SYNC_STORAGE_CHUNK_META_KEY]
    if (typeof splitCount !== "number" || splitCount <= 0) {
      continue
    }

    let serializedValue = ""
    for (let index = 0; index < splitCount; index += 1) {
      const chunkKey = `${key}_${index.toString(36)}`
      const chunk = reassembledValues[chunkKey]
      assert.equal(
        typeof chunk,
        "string",
        `Missing sync storage chunk ${chunkKey}.`
      )

      serializedValue += chunk
      delete reassembledValues[chunkKey]
    }

    reassembledValues[key] = JSON.parse(serializedValue)
  }

  return reassembledValues
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function isChromeForTestingExecutable(filePath) {
  if (process.platform === "darwin") {
    return filePath.endsWith(
      "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
    )
  }

  if (process.platform === "win32") {
    return filePath.endsWith("chrome-win64\\chrome.exe")
  }

  return filePath.endsWith("chrome-linux64/chrome")
}

async function findChromeForTestingExecutables(rootPath) {
  if (!(await pathExists(rootPath))) return []

  const results = []
  const pending = [{ depth: 0, directory: rootPath }]
  const maxDepth = 8

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || current.depth > maxDepth) continue

    let entries = []
    try {
      entries = await fs.readdir(current.directory, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const entryPath = path.join(current.directory, entry.name)
      if (entry.isDirectory()) {
        pending.push({ depth: current.depth + 1, directory: entryPath })
        continue
      }

      if (entry.isFile() && isChromeForTestingExecutable(entryPath)) {
        results.push(entryPath)
      }
    }
  }

  return results.sort().reverse()
}

export async function findChromeBinary() {
  const staticChromeCandidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean)
  const chromeForTestingRoots = [
    process.env.FONTARA_E2E_BROWSER_DIR,
    path.join(ROOT_DIR, ".cache/e2e-browsers/chrome"),
    path.join(os.homedir(), ".cache/puppeteer/chrome"),
    path.join(os.homedir(), "Library/Caches/puppeteer/chrome")
  ].filter(Boolean)
  const chromeForTestingCandidates = (
    await Promise.all(
      chromeForTestingRoots.map(findChromeForTestingExecutables)
    )
  ).flat()

  for (const candidate of [
    process.env.CHROME_PATH,
    ...chromeForTestingCandidates,
    ...staticChromeCandidates
  ].filter(Boolean)) {
    if (await pathExists(candidate)) return candidate
  }

  return null
}

export async function findFirefoxBinary() {
  const candidates = [
    process.env.FIREFOX_PATH,
    "/Applications/Firefox.app/Contents/MacOS/firefox",
    "/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox",
    "/usr/bin/firefox",
    "/usr/local/bin/firefox"
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate
  }

  return null
}

function listenTestServer(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      assert.equal(typeof address, "object")
      resolve({
        close: () => new Promise((done) => server.close(done)),
        port: address.port,
        url: `http://127.0.0.1:${address.port}/`
      })
    })
  })
}

export function createCrossOriginTestServer() {
  const server = http.createServer((request, response) => {
    if (request.url === "/favicon.ico") {
      response.writeHead(404)
      response.end()
      return
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8"
    })

    if (url.pathname === CROSS_ORIGIN_FRAME_PATH) {
      response.end(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>FontARA Cross-Origin Frame Fixture</title>
            <style>
              :root { --cross-frame-font: "Courier New", monospace; }
              body { font-family: var(--cross-frame-font); }
            </style>
            <script>
              window.__fontaraLoadId = String(Date.now()) + "-" + Math.random();
            </script>
          </head>
          <body>
            <p id="cross-frame-text">متن داخل iframe با origin جدا</p>
          </body>
        </html>`)
      return
    }

    response.end(`<!doctype html><html><body></body></html>`)
  })

  return listenTestServer(server)
}

export function createTestServer(options = {}) {
  const { crossOriginFrameUrl = "" } = options
  const server = http.createServer((request, response) => {
    if (request.url === "/favicon.ico") {
      response.writeHead(404)
      response.end()
      return
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8"
    })

    if (url.pathname === HARD_FIXTURE_PATH) {
      const crossOriginFrameMarkup = crossOriginFrameUrl
        ? `<iframe id="${CROSS_ORIGIN_FRAME_NAME}" name="${CROSS_ORIGIN_FRAME_NAME}" src="${crossOriginFrameUrl}"></iframe>`
        : ""

      response.end(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>FontARA MV3 Hard Browser Fixture</title>
            <style>
              :root {
                --fixture-serif: Georgia, "Times New Roman", serif;
                --fixture-ui: Arial, sans-serif;
                --fixture-nested-font: var(--fixture-serif);
                --fixture-virtual-font: var(--fixture-nested-font);
              }
              body { font-family: Times, serif; }
              #editable { font-family: Arial, sans-serif; }
              #nested-editable { font-family: var(--fixture-ui); }
              #spa-root p { font-family: Georgia, serif; }
              #route-root p { font-family: var(--fixture-nested-font); }
              #variable-text {
                --fixture-local-font: var(--fixture-nested-font);
                font-family: var(--fixture-local-font);
              }
              .virtual-row { font-family: var(--fixture-virtual-font); }
            </style>
            <script>
              window.__fontaraLoadId = String(Date.now()) + "-" + Math.random();
              customElements.define("fontara-shadow-card", class extends HTMLElement {
                connectedCallback() {
                  if (this.shadowRoot) return;
                  const root = this.attachShadow({ mode: "open" });
                  const style = document.createElement("style");
                  style.textContent = "p { font-family: Georgia, serif; }";
                  const text = document.createElement("p");
                  text.id = "shadow-text";
                  text.textContent = "متن داخل Shadow DOM";
                  root.append(style, text);
                }
              });
              customElements.define("fontara-adopted-card", class extends HTMLElement {
                connectedCallback() {
                  if (this.shadowRoot) return;
                  const root = this.attachShadow({ mode: "open" });
                  const text = document.createElement("p");
                  text.id = "adopted-text";
                  text.textContent = "متن داخل Shadow DOM با adoptedStyleSheets";

                  try {
                    const sheet = new CSSStyleSheet();
                    sheet.replaceSync(":host { --adopted-font: Georgia, serif; } p { font-family: var(--adopted-font); }");
                    root.adoptedStyleSheets = [sheet];
                    root.append(text);
                  } catch {
                    const style = document.createElement("style");
                    style.textContent = ":host { --adopted-font: Georgia, serif; } p { font-family: var(--adopted-font); }";
                    root.append(style, text);
                  }
                }
              });
              window.__fontaraAddDynamicFixtureText = () => {
                const text = document.createElement("p");
                text.id = "spa-text";
                text.textContent = "متن اضافه شده بعد از load";
                document.getElementById("spa-root").append(text);

                const shadowText = document.createElement("p");
                shadowText.id = "shadow-late-text";
                shadowText.textContent = "متن جدید داخل Shadow DOM";
                document.getElementById("shadow-host").shadowRoot.append(shadowText);
              };
              window.__fontaraNavigateHardFixtureRoute = () => {
                history.pushState({ fontaraRoute: "thread" }, "", "#thread");
                const routeRoot = document.getElementById("route-root");
                routeRoot.textContent = "";
                const routeText = document.createElement("p");
                routeText.id = "spa-route-text";
                routeText.textContent = "متن route جدید در SPA بدون reload";
                routeRoot.append(routeText);
              };
              window.__fontaraMountAdvancedFixtureText = () => new Promise((resolve) => {
                window.__fontaraNavigateHardFixtureRoute();

                if (!document.getElementById("variable-text")) {
                  const variableText = document.createElement("p");
                  variableText.id = "variable-text";
                  variableText.textContent = "متن با CSS variables چندلایه";
                  document.getElementById("advanced-root").append(variableText);
                }

                if (!document.getElementById("adopted-host")) {
                  const adoptedHost = document.createElement("fontara-adopted-card");
                  adoptedHost.id = "adopted-host";
                  document.getElementById("advanced-root").append(adoptedHost);
                }

                if (!document.getElementById("nested-editable")) {
                  const editor = document.createElement("div");
                  editor.id = "nested-editable";
                  editor.setAttribute("contenteditable", "plaintext-only");
                  editor.setAttribute("role", "textbox");
                  editor.setAttribute("aria-label", "FontARA advanced editor");
                  editor.innerHTML = '<blockquote><p id="nested-editable-text" data-text="true"><span>متن nested contenteditable</span></p></blockquote>';
                  document.getElementById("advanced-root").append(editor);
                }

                if (!document.getElementById("virtual-list")) {
                  const list = document.createElement("section");
                  list.id = "virtual-list";
                  document.getElementById("advanced-root").append(list);
                  requestAnimationFrame(() => {
                    const fragment = document.createDocumentFragment();
                    for (let index = 0; index < 36; index += 1) {
                      const row = document.createElement("p");
                      row.className = "virtual-row";
                      row.id = "virtual-row-" + index;
                      row.textContent = "ردیف مجازی " + index;
                      fragment.append(row);
                    }
                    list.append(fragment);
                  });
                }

                window.setTimeout(() => {
                  if (!document.getElementById("lazy-text")) {
                    const lazyText = document.createElement("p");
                    lazyText.id = "lazy-text";
                    lazyText.textContent = "متن lazy بعد از تاخیر";
                    document.getElementById("lazy-root").append(lazyText);
                  }
                  resolve();
                }, 80);
              });
            </script>
          </head>
          <body>
            <main>
              <p id="fontara-text">سلام FontARA بدون reload</p>
              <div id="editable" contenteditable="true">
                <p id="editable-text" data-text="true">متن ویرایشگر</p>
              </div>
              <fontara-shadow-card id="shadow-host"></fontara-shadow-card>
              <section id="spa-root"></section>
              <section id="route-root"></section>
              <section id="advanced-root"></section>
              <section id="lazy-root"></section>
              <iframe id="fontara-frame" src="${FRAME_FIXTURE_PATH}"></iframe>
              ${crossOriginFrameMarkup}
            </main>
          </body>
        </html>`)
      return
    }

    if (url.pathname === FRAME_FIXTURE_PATH) {
      response.end(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>FontARA MV3 Frame Fixture</title>
            <style>
              body { font-family: Times, serif; }
            </style>
            <script>
              window.__fontaraLoadId = String(Date.now()) + "-" + Math.random();
            </script>
          </head>
          <body>
            <p id="frame-text">متن داخل iframe</p>
          </body>
        </html>`)
      return
    }

    response.end(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>FontARA MV3 Browser Test</title>
          <script>
            window.__fontaraLoadId = String(Date.now()) + "-" + Math.random();
          </script>
        </head>
        <body>
          <main>
            <p id="fontara-text">سلام FontARA بدون reload</p>
          </main>
        </body>
      </html>`)
  })

  return listenTestServer(server)
}

async function getFreePort() {
  const server = http.createServer()

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      assert.equal(typeof address, "object")
      const port = address.port
      server.close(() => resolve(port))
    })
  })
}

export async function waitFor(check, options = {}) {
  const {
    interval = 100,
    message = "Timed out waiting for condition.",
    timeout = 10_000
  } = options
  const deadline = Date.now() + timeout
  let lastError = null

  while (Date.now() < deadline) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await delay(interval)
  }

  throw lastError ?? new Error(message)
}

function getHeadlessMode() {
  return !(
    process.env.FONTARA_BROWSER_HEADFUL === "1" ||
    process.env.FONTARA_E2E_HEADFUL === "1"
  )
}

function getChromeLaunchArgs() {
  const args = [
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-sync",
    "--disable-translate"
  ]

  if (process.env.CI === "true") {
    args.push(
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-setuid-sandbox",
      "--no-sandbox"
    )
  }

  return args
}

async function createPage(browser, url, options = {}) {
  const page = await browser.newPage()
  if (options.viewport) {
    await page.setViewport(options.viewport)
  }
  try {
    await page.goto(url, { waitUntil: "load" })
    await page.bringToFront().catch(() => {})
  } catch (error) {
    const isExpectedFirefoxExtensionNavigationError =
      url.startsWith("moz-extension://") &&
      error instanceof Error &&
      error.message.includes("NS_ERROR_NOT_AVAILABLE")

    if (!isExpectedFirefoxExtensionNavigationError) {
      throw error
    }

    await waitFor(
      async () => {
        const currentUrl = page.url()
        if (!currentUrl.startsWith(url)) return false

        return page
          .evaluate(() => document.readyState !== "loading")
          .catch(() => false)
      },
      {
        message: `Firefox opened ${url} but the extension document did not become readable.`
      }
    )
  }
  return page
}

async function launchChromeWithExtension(extensionDir) {
  const chromePath = await findChromeBinary()
  if (!chromePath) {
    return {
      skipReason:
        "Chrome for Testing, Chromium, or Google Chrome was not found on this machine."
    }
  }

  assert.ok(
    await pathExists(path.join(extensionDir, "manifest.json")),
    "Run pnpm debug before this browser test."
  )

  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "fontara-browser-chrome-")
  )
  const browser = await puppeteer.launch({
    args: getChromeLaunchArgs(),
    browser: "chrome",
    defaultViewport: BROWSER_VIEWPORTS.desktop,
    enableExtensions: [extensionDir],
    executablePath: chromePath,
    headless: getHeadlessMode(),
    pipe: true,
    userDataDir
  })

  try {
    const extensionBaseUrl = await findExtensionBaseUrl(
      browser,
      "chrome-extension://"
    )
    assert.ok(extensionBaseUrl, "Could not resolve Chrome extension origin.")
    const extensionId = new URL(extensionBaseUrl).host
    await delay(1000)
    return {
      browser,
      extensionBaseUrl,
      extensionId,
      userDataDir
    }
  } catch (error) {
    await browser.close().catch(() => {})
    await fs.rm(userDataDir, { force: true, recursive: true })
    throw error
  }
}

async function launchFirefoxWithExtension(extensionDir) {
  const firefoxPath = await findFirefoxBinary()
  if (!firefoxPath) {
    return {
      skipReason: "Firefox was not found on this machine."
    }
  }

  assert.ok(
    await pathExists(path.join(extensionDir, "manifest.json")),
    "Run pnpm debug:firefox before this browser test."
  )

  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "fontara-browser-firefox-")
  )
  const remoteDebuggingPort = await getFreePort()
  const browser = await puppeteer.launch({
    args: [`--remote-debugging-port=${remoteDebuggingPort}`],
    browser: "firefox",
    defaultViewport: BROWSER_VIEWPORTS.desktop,
    executablePath: firefoxPath,
    headless: process.env.FONTARA_FIREFOX_HEADLESS === "1",
    protocol: "webDriverBiDi",
    userDataDir
  })

  try {
    const extensionId = await browser.installExtension(extensionDir)
    const extensionBaseUrl =
      (await findExtensionBaseUrl(browser, "moz-extension://")) ??
      `moz-extension://${extensionId}`
    await delay(1000)

    return { browser, extensionBaseUrl, extensionId, userDataDir }
  } catch (error) {
    await browser.close().catch(() => {})
    await fs.rm(userDataDir, { force: true, recursive: true })
    throw error
  }
}

async function withExtensionHarness(testContext, launchBrowser, callback) {
  const launchResult = await launchBrowser()
  if (launchResult.skipReason) {
    testContext.skip(launchResult.skipReason)
    return
  }

  const { browser, extensionBaseUrl, extensionId, userDataDir } = launchResult
  let crossOriginServer = null
  let server = null

  try {
    crossOriginServer = await createCrossOriginTestServer()
    server = await createTestServer({
      crossOriginFrameUrl: new URL(
        CROSS_ORIGIN_FRAME_PATH,
        crossOriginServer.url
      ).href
    })

    await callback({
      browser,
      crossOriginServer,
      createExtensionPage: (relativePath, options = {}) =>
        createPage(browser, `${extensionBaseUrl}/${relativePath}`, options),
      createFixturePage: (options = {}) => {
        const { path: fixturePath = "/", ...pageOptions } = options
        return createPage(
          browser,
          new URL(fixturePath, server.url).href,
          pageOptions
        )
      },
      extensionBaseUrl,
      extensionId,
      server
    })
  } finally {
    await browser.close().catch(() => {})
    await server?.close()
    await crossOriginServer?.close()
    await fs.rm(userDataDir, { force: true, recursive: true })
  }
}

export async function withChromeMv3ExtensionHarness(testContext, callback) {
  await withExtensionHarness(
    testContext,
    () => launchChromeWithExtension(CHROME_EXTENSION_DIR),
    callback
  )
}

export async function withFirefoxMv3ExtensionHarness(testContext, callback) {
  await withExtensionHarness(
    testContext,
    () => launchFirefoxWithExtension(FIREFOX_EXTENSION_DIR),
    callback
  )
}

async function findExtensionBaseUrl(browser, protocol) {
  return waitFor(
    () => {
      const target = browser.targets().find((item) => {
        const url = item.url()
        return (
          url.startsWith(protocol) &&
          (url.endsWith("/background/index.js") || url.includes("/background/"))
        )
      })

      if (!target) return null

      const url = new URL(target.url())
      return `${url.protocol}//${url.host}`
    },
    {
      message: `Could not resolve ${protocol} extension origin.`
    }
  ).catch(() => null)
}

export async function evaluate(page, pageFunction, ...args) {
  assert.equal(typeof pageFunction, "function")
  return page.evaluate(pageFunction, ...args)
}

export async function sendSettingsFromOptions(optionsPage, settings) {
  const response = await optionsPage.evaluate(
    (messageType, nextSettings) =>
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            data: nextSettings,
            type: messageType
          },
          (messageResponse) => {
            const error = chrome.runtime.lastError
            if (error) {
              reject(new Error(error.message))
              return
            }
            resolve(messageResponse)
          }
        )
      }),
    MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS,
    settings
  )

  assert.ok(response, "FontARA did not acknowledge settings.")
  assert.equal(
    response && typeof response === "object" && "error" in response
      ? response.error
      : null,
    null
  )
}

async function sendContentBridgePageRequest(page, request, options = {}) {
  const { timeout = 10_000 } = options
  const response = await page.evaluate(
    ({ bridgeRequest, requestTimeout, responseType }) =>
      new Promise((resolve, reject) => {
        const requestId = `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2)}`
        const timeout = setTimeout(() => {
          window.removeEventListener("message", handleMessage)
          reject(new Error("FontARA browser test bridge timed out."))
        }, requestTimeout)

        function handleMessage(event) {
          if (event.source && event.source !== window) return

          const data = event.data
          if (
            !data ||
            data.type !== responseType ||
            data.requestId !== requestId
          ) {
            return
          }

          clearTimeout(timeout)
          window.removeEventListener("message", handleMessage)

          if (data.error) {
            reject(new Error(data.error))
            return
          }

          resolve(data.response)
        }

        window.addEventListener("message", handleMessage)
        window.postMessage(
          {
            ...bridgeRequest,
            requestId
          },
          "*"
        )
      }),
    {
      bridgeRequest: request,
      requestTimeout: timeout,
      responseType: FONTARA_BROWSER_TEST_PAGE_RESPONSE
    }
  )

  assert.ok(
    response,
    "FontARA browser test bridge did not acknowledge message."
  )
  assert.equal(
    response && typeof response === "object" && "error" in response
      ? response.error
      : null,
    null
  )

  return response
}

export async function sendUIMessageFromContentBridge(
  page,
  message,
  options = {}
) {
  return sendContentBridgePageRequest(
    page,
    {
      message,
      type: FONTARA_BROWSER_TEST_PAGE_REQUEST
    },
    options
  )
}

export async function waitForContentBridge(page) {
  await waitFor(
    () =>
      sendContentBridgePageRequest(
        page,
        { type: FONTARA_BROWSER_TEST_PAGE_PING },
        { timeout: 500 }
      ),
    {
      message: "FontARA content bridge did not become ready."
    }
  )

  const data = await waitFor(
    () =>
      sendUIMessageFromContentBridge(
        page,
        { type: MESSAGE_TYPES_UI_TO_BG.GET_DATA },
        { timeout: 2000 }
      ),
    {
      message: "FontARA extension runtime did not become ready."
    }
  )

  // Chromium can still flush startup storage listeners just after the first
  // service-worker wake-up; keep the first settings write out of that window.
  await delay(EXTENSION_RUNTIME_SETTLE_MS)
  return data
}

export async function sendSettingsFromContentBridge(page, settings) {
  return sendUIMessageFromContentBridge(page, {
    data: settings,
    type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
  })
}

export async function getPageFontState(page) {
  return page.evaluate(() => {
    const element = document.getElementById("fontara-text")
    return {
      dynamicStyleText:
        document.getElementById("fontara-dynamic-font")?.textContent ?? "",
      fontFamily: element ? getComputedStyle(element).fontFamily : "",
      inlineStyle: element?.getAttribute("style") ?? "",
      loadId: window.__fontaraLoadId,
      textStrokeStyleText:
        document.getElementById("fontara-text-stroke-style")?.textContent ?? ""
    }
  })
}

function normalizeInlineExpectation(value) {
  if (value === true) return "fontara"
  if (value === false) return "clean"
  return value
}

function normalizeTextStrokeWidth(value) {
  return typeof value === "number" ? `${value}px` : String(value)
}

function createStyleExpectationTargetState(target, index, actualTarget) {
  return {
    actual: actualTarget,
    expected: target,
    index,
    name: target.name ?? target.selector ?? `target ${index + 1}`
  }
}

function styleSheetsMatch(snapshot, styleSheets) {
  if (!styleSheets) return true

  if ("font" in styleSheets) {
    if (
      styleSheets.font === false &&
      snapshot.dynamicFontStyleText.trim() !== ""
    ) {
      return false
    }
    if (
      styleSheets.font === true &&
      !snapshot.dynamicFontStyleText.includes(FONTARA_INLINE_FONT_MARKER)
    ) {
      return false
    }
    if (
      typeof styleSheets.font === "string" &&
      !snapshot.dynamicFontStyleText.includes(styleSheets.font)
    ) {
      return false
    }
  }

  if ("editableFont" in styleSheets) {
    if (
      styleSheets.editableFont === false &&
      snapshot.editableFontStyleText.trim() !== ""
    ) {
      return false
    }
    if (
      styleSheets.editableFont === true &&
      !snapshot.editableFontStyleText.includes(FONTARA_INLINE_FONT_MARKER)
    ) {
      return false
    }
    if (
      typeof styleSheets.editableFont === "string" &&
      !snapshot.editableFontStyleText.includes(styleSheets.editableFont)
    ) {
      return false
    }
  }

  if ("textStroke" in styleSheets) {
    if (
      styleSheets.textStroke === false &&
      snapshot.textStrokeStyleText.trim() !== ""
    ) {
      return false
    }
    if (typeof styleSheets.textStroke === "number") {
      const expectedDeclaration = `-webkit-text-stroke: ${styleSheets.textStroke}px !important;`
      if (!snapshot.textStrokeStyleText.includes(expectedDeclaration)) {
        return false
      }
    }
  }

  return true
}

function styleTargetMatches(targetState) {
  const { actual, expected } = targetState
  if (!actual.rootExists || !actual.exists) return false

  if ("font" in expected) {
    if (
      typeof expected.font === "string" &&
      !actual.fontFamily.includes(expected.font)
    ) {
      return false
    }
    if (
      expected.font === false &&
      FONTARA_FONT_FAMILY_PATTERN.test(actual.fontFamily)
    ) {
      return false
    }
  }

  const inlineExpectation = normalizeInlineExpectation(expected.inline)
  if (
    inlineExpectation === "fontara" &&
    !actual.inlineStyle.includes(FONTARA_INLINE_FONT_MARKER)
  ) {
    return false
  }
  if (
    inlineExpectation === "clean" &&
    actual.inlineStyle.includes(FONTARA_INLINE_FONT_MARKER)
  ) {
    return false
  }

  if ("textStroke" in expected) {
    if (
      expected.textStroke === false &&
      actual.webkitTextStrokeWidth !== "0px"
    ) {
      return false
    }
    if (
      (typeof expected.textStroke === "number" ||
        typeof expected.textStroke === "string") &&
      actual.webkitTextStrokeWidth !==
        normalizeTextStrokeWidth(expected.textStroke)
    ) {
      return false
    }
  }

  return true
}

function styleExpectationMatches(snapshot, expectation) {
  const expectedTargets = expectation.targets ?? []

  if (
    expectation.loadId !== undefined &&
    snapshot.loadId !== expectation.loadId
  ) {
    return false
  }

  if (!styleSheetsMatch(snapshot, expectation.styleSheets)) {
    return false
  }

  if (snapshot.targets.length !== expectedTargets.length) {
    return false
  }

  return snapshot.targets
    .map((actualTarget, index) =>
      createStyleExpectationTargetState(
        expectedTargets[index],
        index,
        actualTarget
      )
    )
    .every(styleTargetMatches)
}

export function createBasicPageStyleExpectation({
  applied = true,
  fontName,
  loadId,
  message,
  textStroke
} = {}) {
  return {
    loadId,
    message,
    styleSheets: {
      font: applied ? (fontName ?? true) : false,
      ...(textStroke !== undefined ? { textStroke } : {})
    },
    targets: [
      {
        font: applied ? fontName : false,
        inline: applied ? "fontara" : "clean",
        name: "main text",
        selector: "#fontara-text",
        ...(textStroke !== undefined ? { textStroke } : {})
      }
    ]
  }
}

export function createHardFixtureStyleExpectation({
  applied = true,
  includeAdvanced = false,
  includeCrossOriginFrame = true,
  fontName,
  includeDynamic = false,
  loadId,
  message
} = {}) {
  const inlineExpectation = applied ? "fontara" : "clean"
  const computedFontExpectation = applied ? fontName : false
  const targets = [
    {
      font: computedFontExpectation,
      inline: inlineExpectation,
      name: "main text",
      selector: "#fontara-text"
    },
    {
      font: computedFontExpectation,
      frame: "#fontara-frame",
      inline: inlineExpectation,
      name: "iframe text",
      selector: "#frame-text"
    },
    {
      font: computedFontExpectation,
      inline: inlineExpectation,
      name: "shadow text",
      selector: "#shadow-text",
      shadow: "#shadow-host"
    },
    {
      font: computedFontExpectation,
      inline: "clean",
      name: "contenteditable text",
      selector: "#editable-text"
    }
  ]

  if (includeDynamic) {
    targets.push(
      {
        font: computedFontExpectation,
        inline: inlineExpectation,
        name: "dynamic SPA text",
        selector: "#spa-text"
      },
      {
        font: computedFontExpectation,
        inline: inlineExpectation,
        name: "late shadow text",
        selector: "#shadow-late-text",
        shadow: "#shadow-host"
      }
    )
  }

  if (includeAdvanced) {
    targets.push(
      {
        font: computedFontExpectation,
        inline: inlineExpectation,
        name: "SPA route text",
        selector: "#spa-route-text"
      },
      {
        font: computedFontExpectation,
        inline: inlineExpectation,
        name: "CSS variable text",
        selector: "#variable-text"
      },
      {
        font: computedFontExpectation,
        inline: inlineExpectation,
        name: "adoptedStyleSheets shadow text",
        selector: "#adopted-text",
        shadow: "#adopted-host"
      },
      {
        font: computedFontExpectation,
        inline: "clean",
        name: "nested contenteditable text",
        selector: "#nested-editable-text"
      },
      {
        font: computedFontExpectation,
        inline: inlineExpectation,
        name: "virtualized list row",
        selector: "#virtual-row-35"
      },
      {
        font: computedFontExpectation,
        inline: inlineExpectation,
        name: "lazy DOM text",
        selector: "#lazy-text"
      }
    )

    if (includeCrossOriginFrame) {
      targets.push({
        font: computedFontExpectation,
        frameName: CROSS_ORIGIN_FRAME_NAME,
        frameUrlIncludes: CROSS_ORIGIN_FRAME_PATH,
        inline: inlineExpectation,
        name: "cross-origin iframe text",
        selector: "#cross-frame-text"
      })
    }
  }

  return {
    loadId,
    message,
    styleSheets: {
      editableFont: applied,
      font: applied ? (fontName ?? true) : false
    },
    targets
  }
}

function getStyleExpectationTargetStateInBrowser(target) {
  function resolveTargetRoot(targetConfig) {
    let root = document
    const path = []

    if (targetConfig.frame || targetConfig.frameSelector) {
      const frameSelector = targetConfig.frame ?? targetConfig.frameSelector
      const frame = document.querySelector(frameSelector)
      path.push(`frame:${frameSelector}`)
      if (!frame?.contentDocument) {
        return { path, root: null }
      }
      root = frame.contentDocument
    }

    if (targetConfig.shadow || targetConfig.shadowHost) {
      const shadowSelector = targetConfig.shadow ?? targetConfig.shadowHost
      const host = root.querySelector(shadowSelector)
      path.push(`shadow:${shadowSelector}`)
      if (!host?.shadowRoot) {
        return { path, root: null }
      }
      root = host.shadowRoot
    }

    return { path, root }
  }

  const { path, root } = resolveTargetRoot(target)
  const element = root?.querySelector(target.selector) ?? null
  const computedStyle = element ? getComputedStyle(element) : null

  return {
    exists: Boolean(element),
    fontFamily: computedStyle?.fontFamily ?? "",
    inlineStyle: element?.getAttribute("style") ?? "",
    path,
    rootExists: Boolean(root),
    selector: target.selector,
    tagName: element?.tagName ?? "",
    textContent: element?.textContent ?? "",
    webkitTextStrokeWidth:
      computedStyle?.getPropertyValue("-webkit-text-stroke-width") ?? ""
  }
}

function targetUsesBrowserFrame(target) {
  return Boolean(target.frameName || target.frameUrlIncludes)
}

function findStyleExpectationBrowserFrame(page, target) {
  return page.frames().find((frame) => {
    if (target.frameName && frame.name() === target.frameName) return true
    return Boolean(
      target.frameUrlIncludes && frame.url().includes(target.frameUrlIncludes)
    )
  })
}

function createMissingBrowserFrameTargetState(target) {
  const path = []
  if (target.frameName) path.push(`browser-frame-name:${target.frameName}`)
  if (target.frameUrlIncludes) {
    path.push(`browser-frame-url:${target.frameUrlIncludes}`)
  }

  return {
    exists: false,
    fontFamily: "",
    inlineStyle: "",
    path,
    rootExists: false,
    selector: target.selector,
    tagName: "",
    textContent: "",
    webkitTextStrokeWidth: ""
  }
}

async function getStyleExpectationTargetState(page, target) {
  if (!targetUsesBrowserFrame(target)) {
    return page.evaluate(getStyleExpectationTargetStateInBrowser, target)
  }

  const frame = findStyleExpectationBrowserFrame(page, target)
  if (!frame) return createMissingBrowserFrameTargetState(target)

  return frame.evaluate(getStyleExpectationTargetStateInBrowser, target)
}

export async function getPageStyleExpectationState(page, expectation) {
  const [pageSnapshot, targets] = await Promise.all([
    page.evaluate(() => ({
      dynamicFontStyleText:
        document.getElementById("fontara-dynamic-font")?.textContent ?? "",
      editableFontStyleText:
        document.getElementById("fontara-editable-font-style")?.textContent ??
        "",
      loadId: window.__fontaraLoadId,
      textStrokeStyleText:
        document.getElementById("fontara-text-stroke-style")?.textContent ?? ""
    })),
    Promise.all(
      (expectation.targets ?? []).map((target) =>
        getStyleExpectationTargetState(page, target)
      )
    )
  ])

  return {
    ...pageSnapshot,
    targets
  }
}

export async function expectPageStyles(page, expectation) {
  let lastSnapshot = null

  try {
    return await waitFor(
      async () => {
        const snapshot = await getPageStyleExpectationState(page, expectation)
        lastSnapshot = snapshot

        return styleExpectationMatches(snapshot, expectation) ? snapshot : false
      },
      {
        message: expectation.message ?? "FontARA page style expectation failed."
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}

Expected style state:
${JSON.stringify(expectation, null, 2)}

Last style state:
${JSON.stringify(lastSnapshot, null, 2)}`
    }
    throw error
  }
}

export async function getExtensionLocalValues(extensionPage, keys) {
  return extensionPage.evaluate(
    (storageKeys) => chrome.storage.local.get(storageKeys),
    keys
  )
}

export async function setExtensionLocalValues(extensionPage, values) {
  await extensionPage.evaluate(
    (nextValues) => chrome.storage.local.set(nextValues),
    values
  )
}

export async function waitForExtensionLocalValue(
  extensionPage,
  key,
  expectedValue
) {
  let lastValue

  try {
    return await waitFor(
      async () => {
        const values = await getExtensionLocalValues(extensionPage, [key])
        lastValue = values[key]

        return valuesAreEqual(lastValue, expectedValue) ? values : false
      },
      {
        message: `FontARA storage key ${key} did not become ${JSON.stringify(
          expectedValue
        )}.`
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}

Last value:
${JSON.stringify(lastValue, null, 2)}`
    }
    throw error
  }
}

export async function getExtensionSyncRawValues(extensionPage) {
  return extensionPage.evaluate(() => chrome.storage.sync.get(null))
}

export async function getExtensionSyncReassembledValues(extensionPage) {
  return reassembleSyncStorageChunks(
    await getExtensionSyncRawValues(extensionPage)
  )
}

export async function waitForExtensionSyncValue(
  extensionPage,
  key,
  expectedValue
) {
  let lastValue

  try {
    return await waitFor(
      async () => {
        const values = await getExtensionSyncReassembledValues(extensionPage)
        lastValue = values[key]

        return valuesAreEqual(lastValue, expectedValue) ? values : false
      },
      {
        message: `FontARA sync storage key ${key} did not become ${JSON.stringify(
          expectedValue
        )}.`
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}

Last sync value:
${JSON.stringify(lastValue, null, 2)}`
    }
    throw error
  }
}

export async function clickByTestId(page, testId) {
  const selector = testIdSelector(testId)
  await page.waitForSelector(selector, { visible: true })
  await page.$eval(selector, (element) => {
    element.scrollIntoView({ block: "center", inline: "center" })
  })

  const point = await waitFor(
    () =>
      page.$eval(selector, (element) => {
        const rect = element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return false

        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        const topElement = document.elementFromPoint(x, y)

        if (topElement !== element && !element.contains(topElement)) {
          return false
        }

        return { x, y }
      }),
    {
      message: `Element ${testId} did not become clickable.`
    }
  )

  await page.mouse.click(point.x, point.y)
}

export async function setValueByTestId(page, testId, value) {
  const selector = testIdSelector(testId)
  await page.waitForSelector(selector)
  await page.$eval(
    selector,
    (element, nextValue) => {
      const prototype = Object.getPrototypeOf(element)
      const valueSetter = Object.getOwnPropertyDescriptor(
        prototype,
        "value"
      )?.set

      element.focus()
      if (valueSetter) {
        valueSetter.call(element, String(nextValue))
      } else {
        element.value = String(nextValue)
      }
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: String(nextValue),
          inputType: "insertText"
        })
      )
      element.dispatchEvent(new Event("change", { bubbles: true }))
    },
    value
  )
}

export async function uploadFileByTestId(page, testId, filePath) {
  const selector = testIdSelector(testId)
  await page.waitForSelector(selector)
  const input = await page.$(selector)
  assert.ok(input, `Input ${testId} was not found.`)
  await input.uploadFile(filePath)
}

export async function chooseFileByTestId(page, testId, filePath) {
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    clickByTestId(page, testId)
  ])

  await fileChooser.accept([filePath])
}

export async function installDownloadCapture(page) {
  await page.evaluate(() => {
    const state = {
      downloads: []
    }
    const originalCreateObjectURL = URL.createObjectURL.bind(URL)
    const originalClick = HTMLAnchorElement.prototype.click

    window.__fontaraDownloadCaptureState = state
    window.__fontaraLastDownloadBlob = null
    window.__fontaraDownloadPromise = null

    URL.createObjectURL = (value) => {
      const url = originalCreateObjectURL(value)
      if (value instanceof Blob) {
        window.__fontaraLastDownloadBlob = value
      }
      return url
    }

    HTMLAnchorElement.prototype.click = function click() {
      if (this.download && window.__fontaraLastDownloadBlob) {
        const blob = window.__fontaraLastDownloadBlob
        const download = this.download
        const href = this.href
        window.__fontaraDownloadPromise = blob.text().then((text) => {
          state.downloads.push({ download, href, text })
          return state.downloads
        })
        return
      }

      return originalClick.call(this)
    }
  })
}

export async function waitForCapturedDownload(page) {
  return waitFor(
    () =>
      page.evaluate(async () => {
        if (window.__fontaraDownloadPromise) {
          await window.__fontaraDownloadPromise
        }

        return window.__fontaraDownloadCaptureState?.downloads[0] ?? false
      }),
    {
      message: "FontARA did not capture a settings export download."
    }
  )
}

export async function waitForSwitchChecked(page, testId, expectedChecked) {
  const selector = testIdSelector(testId)

  return waitFor(
    async () => {
      await page.waitForSelector(selector, { visible: true })
      return page.$eval(
        selector,
        (element, checked) =>
          element.getAttribute("aria-checked") === String(checked),
        expectedChecked
      )
    },
    {
      message: `Switch ${testId} did not become ${String(expectedChecked)}.`
    }
  )
}

export async function waitForInputChecked(page, testId, expectedChecked) {
  const selector = testIdSelector(testId)

  return waitFor(
    async () => {
      await page.waitForSelector(selector)
      return page.$eval(
        selector,
        (element, checked) => element.checked === checked,
        expectedChecked
      )
    },
    {
      message: `Input ${testId} did not become ${String(expectedChecked)}.`
    }
  )
}

export async function getExtensionSyncValues(extensionPage, keys) {
  return extensionPage.evaluate(
    (storageKeys) => chrome.storage.sync.get(storageKeys),
    keys
  )
}

export async function assertStoredActivationSettings(
  extensionPage,
  sitePattern,
  selectedFont,
  syncSettings = false
) {
  const keys = [
    STORAGE_KEYS.DISABLED_FOR,
    STORAGE_KEYS.ENABLED_BY_DEFAULT,
    STORAGE_KEYS.ENABLED_FOR,
    STORAGE_KEYS.EXTENSION_ENABLED,
    STORAGE_KEYS.SELECTED_FONT,
    STORAGE_KEYS.SYNC_SETTINGS,
    SETTINGS_UPDATED_AT_KEY
  ]
  const localValues = await getExtensionLocalValues(extensionPage, keys)
  const syncValues = await getExtensionSyncValues(extensionPage, keys)
  const snapshot = JSON.stringify({ localValues, syncValues }, null, 2)

  assert.equal(localValues[STORAGE_KEYS.SELECTED_FONT], selectedFont, snapshot)
  assert.equal(localValues[STORAGE_KEYS.EXTENSION_ENABLED], true, snapshot)
  assert.equal(localValues[STORAGE_KEYS.ENABLED_BY_DEFAULT], false, snapshot)
  assert.deepEqual(
    localValues[STORAGE_KEYS.ENABLED_FOR],
    [sitePattern],
    snapshot
  )
  assert.deepEqual(localValues[STORAGE_KEYS.DISABLED_FOR], [], snapshot)
  assert.equal(localValues[STORAGE_KEYS.SYNC_SETTINGS], syncSettings, snapshot)
  assert.equal(typeof localValues[SETTINGS_UPDATED_AT_KEY], "number", snapshot)
}

export async function waitForFont(page, fontName, expectedLoadId) {
  return expectPageStyles(
    page,
    createBasicPageStyleExpectation({
      fontName,
      loadId: expectedLoadId,
      message: `FontARA did not apply ${fontName} without reloading the page.`
    })
  )
}

export async function waitForFontRemoved(page, expectedLoadId) {
  return expectPageStyles(
    page,
    createBasicPageStyleExpectation({
      applied: false,
      loadId: expectedLoadId,
      message: "FontARA did not remove the selected font without reloading."
    })
  )
}

export async function waitForTextStroke(page, expectedWidth, expectedLoadId) {
  return expectPageStyles(page, {
    loadId: expectedLoadId,
    message: `FontARA did not apply text stroke ${expectedWidth}px without reloading.`,
    styleSheets: {
      textStroke: expectedWidth
    },
    targets: [
      {
        name: "main text",
        selector: "#fontara-text",
        textStroke: expectedWidth
      }
    ]
  })
}

export async function addHardFixtureDynamicText(page) {
  await page.evaluate(() => window.__fontaraAddDynamicFixtureText())
}

export async function mountHardFixtureAdvancedText(page) {
  await page.evaluate(() => window.__fontaraMountAdvancedFixtureText())
}

export async function getHardFixtureFontState(page) {
  return page.evaluate(() => {
    function getElementFontState(element) {
      return {
        exists: Boolean(element),
        fontFamily: element ? getComputedStyle(element).fontFamily : "",
        inlineStyle: element?.getAttribute("style") ?? ""
      }
    }

    const shadowRoot = document.getElementById("shadow-host")?.shadowRoot
    const frameDocument =
      document.getElementById("fontara-frame")?.contentDocument ?? null

    return {
      dynamicStyleText:
        document.getElementById("fontara-dynamic-font")?.textContent ?? "",
      editableStyleText:
        document.getElementById("fontara-editable-font-style")?.textContent ??
        "",
      frame: getElementFontState(frameDocument?.getElementById("frame-text")),
      loadId: window.__fontaraLoadId,
      main: getElementFontState(document.getElementById("fontara-text")),
      shadow: getElementFontState(shadowRoot?.getElementById("shadow-text")),
      shadowLate: getElementFontState(
        shadowRoot?.getElementById("shadow-late-text")
      ),
      spa: getElementFontState(document.getElementById("spa-text")),
      editable: getElementFontState(document.getElementById("editable-text"))
    }
  })
}

export async function waitForHardFixtureFonts(
  page,
  fontName,
  expectedLoadId,
  options = {}
) {
  return expectPageStyles(
    page,
    createHardFixtureStyleExpectation({
      fontName,
      includeDynamic: options.includeDynamic,
      loadId: expectedLoadId,
      message: `FontARA did not apply ${fontName} to the hard fixture without reloading.`
    })
  )
}

export async function waitForHardFixtureFontsRemoved(
  page,
  expectedLoadId,
  options = {}
) {
  return expectPageStyles(
    page,
    createHardFixtureStyleExpectation({
      applied: false,
      includeDynamic: options.includeDynamic,
      loadId: expectedLoadId,
      message:
        "FontARA did not remove fonts from the hard fixture without reloading."
    })
  )
}

export async function getExtensionPageLayoutState(page) {
  return page.evaluate(() => {
    const root = document.getElementById("root")
    const viewportWidth = document.documentElement.clientWidth
    const overflowElements = Array.from(document.body.querySelectorAll("*"))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return (
          rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1)
        )
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          className:
            typeof element.className === "string" ? element.className : "",
          left: rect.left,
          right: rect.right,
          tagName: element.tagName.toLowerCase()
        }
      })

    return {
      bodyTextLength: document.body.textContent?.trim().length ?? 0,
      hasRootContent: (root?.childElementCount ?? 0) > 0,
      overflowElements,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth
    }
  })
}
