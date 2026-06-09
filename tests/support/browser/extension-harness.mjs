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

export function createTestServer() {
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
      response.end(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>FontARA MV3 Hard Browser Fixture</title>
            <style>
              body { font-family: Times, serif; }
              #editable { font-family: Arial, sans-serif; }
              #spa-root p { font-family: Georgia, serif; }
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
              <iframe id="fontara-frame" src="${FRAME_FIXTURE_PATH}"></iframe>
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
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`
    ],
    browser: "chrome",
    defaultViewport: BROWSER_VIEWPORTS.desktop,
    enableExtensions: true,
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
  const server = await createTestServer()

  try {
    await callback({
      browser,
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
    await server.close()
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
  let lastState = null

  try {
    return await waitFor(
      async () => {
        const state = await getPageFontState(page)
        lastState = state
        return (
          state.loadId === expectedLoadId &&
          state.dynamicStyleText.includes(fontName) &&
          state.inlineStyle.includes("var(--fontara-font)") &&
          state
        )
      },
      {
        message: `FontARA did not apply ${fontName} without reloading the page.`
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}

Last page font state:
${JSON.stringify(lastState, null, 2)}`
    }
    throw error
  }
}

export async function waitForFontRemoved(page, expectedLoadId) {
  let lastState = null

  try {
    return await waitFor(
      async () => {
        const state = await getPageFontState(page)
        lastState = state
        return (
          state.loadId === expectedLoadId &&
          !state.inlineStyle.includes("var(--fontara-font)") &&
          state
        )
      },
      {
        message: "FontARA did not remove the selected font without reloading."
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}

Last page font state:
${JSON.stringify(lastState, null, 2)}`
    }
    throw error
  }
}

export async function waitForTextStroke(page, expectedWidth, expectedLoadId) {
  let lastState = null
  const expectedDeclaration = `-webkit-text-stroke: ${expectedWidth}px !important;`

  try {
    return await waitFor(
      async () => {
        const state = await getPageFontState(page)
        lastState = state
        return (
          state.loadId === expectedLoadId &&
          state.textStrokeStyleText.includes(expectedDeclaration) &&
          state
        )
      },
      {
        message: `FontARA did not apply text stroke ${expectedWidth}px without reloading.`
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}

Last page font state:
${JSON.stringify(lastState, null, 2)}`
    }
    throw error
  }
}

export async function addHardFixtureDynamicText(page) {
  await page.evaluate(() => window.__fontaraAddDynamicFixtureText())
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

function hardFixtureHasAppliedFont(state, fontName, options = {}) {
  const { includeDynamic = false } = options
  const requiredInlineTargets = [state.main, state.frame, state.shadow]
  const requiredComputedTargets = [state.main, state.frame, state.shadow]

  if (includeDynamic) {
    requiredInlineTargets.push(state.spa, state.shadowLate)
    requiredComputedTargets.push(state.spa, state.shadowLate)
  }

  requiredComputedTargets.push(state.editable)

  return (
    state.dynamicStyleText.includes(fontName) &&
    state.editableStyleText.includes("var(--fontara-font)") &&
    requiredComputedTargets.every(
      (target) => target.exists && target.fontFamily.includes(fontName)
    ) &&
    requiredInlineTargets.every((target) =>
      target.inlineStyle.includes("var(--fontara-font)")
    )
  )
}

function hardFixtureHasRemovedFont(state, options = {}) {
  const { includeDynamic = false } = options
  const targets = [state.main, state.frame, state.shadow, state.editable]

  if (includeDynamic) {
    targets.push(state.spa, state.shadowLate)
  }

  return (
    state.dynamicStyleText === "" &&
    state.editableStyleText === "" &&
    targets.every(
      (target) =>
        target.exists && !target.inlineStyle.includes("var(--fontara-font)")
    )
  )
}

export async function waitForHardFixtureFonts(
  page,
  fontName,
  expectedLoadId,
  options = {}
) {
  let lastState = null

  try {
    return await waitFor(
      async () => {
        const state = await getHardFixtureFontState(page)
        lastState = state
        return (
          state.loadId === expectedLoadId &&
          hardFixtureHasAppliedFont(state, fontName, options) &&
          state
        )
      },
      {
        message: `FontARA did not apply ${fontName} to the hard fixture without reloading.`
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}

Last hard fixture font state:
${JSON.stringify(lastState, null, 2)}`
    }
    throw error
  }
}

export async function waitForHardFixtureFontsRemoved(
  page,
  expectedLoadId,
  options = {}
) {
  let lastState = null

  try {
    return await waitFor(
      async () => {
        const state = await getHardFixtureFontState(page)
        lastState = state
        return (
          state.loadId === expectedLoadId &&
          hardFixtureHasRemovedFont(state, options) &&
          state
        )
      },
      {
        message:
          "FontARA did not remove fonts from the hard fixture without reloading."
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      error.message = `${error.message}

Last hard fixture font state:
${JSON.stringify(lastState, null, 2)}`
    }
    throw error
  }
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
