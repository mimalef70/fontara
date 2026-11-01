import assert from "node:assert/strict"
import test, { afterEach } from "node:test"
import {
  collectActiveTabInfo,
  getCommandURL
} from "../../src/background/extension-data"
import { STORAGE_KEYS } from "../../src/config/storage"
import {
  getRelatedFrameRuntimePageURL,
  sanitizeRuntimePageURL
} from "../../src/utils/runtime-url"
import { normalizeStorageValues } from "../../src/utils/storage-normalization"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

test("storage normalization removes credentials, query, and hash from captured site URLs", async () => {
  Reflect.set(globalThis, "chrome", {})
  const secretURL =
    "https://user:password@EXAMPLE.com/account/private?token=secret#message"
  const settings = await normalizeStorageValues({
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.WEBSITE_LIST]: [
      {
        isActive: true,
        regex: "^https://example\\.com/.*$",
        url: secretURL
      }
    ]
  })
  const serialized = JSON.stringify(settings)
  const websites = settings[STORAGE_KEYS.WEBSITE_LIST] as Array<{
    regex: string
    url: string
  }>
  const capturedSite = websites.find((website) => website.url === "example.com")

  assert.deepEqual(capturedSite, {
    isActive: true,
    regex: "^https?://example\\.com/?.*$",
    url: "example.com"
  })
  assert.doesNotMatch(serialized, /user|password|token|secret|#message/)
})

test("explicit path scope keeps only a normalized path", async () => {
  Reflect.set(globalThis, "chrome", {})
  const settings = await normalizeStorageValues({
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [],
    [STORAGE_KEYS.WEBSITE_LIST]: [
      {
        pattern: "example.com/projects/private",
        regex: "^https://example\\.com/.*$",
        url: "https://EXAMPLE.com/projects/private/?token=secret#fragment"
      }
    ]
  })
  const websites = settings[STORAGE_KEYS.WEBSITE_LIST] as Array<{
    url: string
  }>

  assert.ok(
    websites.some((website) => website.url === "example.com/projects/private")
  )
  assert.doesNotMatch(JSON.stringify(settings), /token=secret|#fragment/)
})

test("runtime page state removes URL secrets while preserving the activation path", async () => {
  const secretURL =
    "https://user:password@EXAMPLE.com/account/private?token=secret#message"
  Reflect.set(globalThis, "chrome", {
    tabs: {
      query(
        _query: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void
      ) {
        callback([{ id: 7, url: secretURL } as chrome.tabs.Tab])
      }
    }
  })

  assert.equal(
    sanitizeRuntimePageURL(secretURL),
    "https://example.com/account/private"
  )
  assert.equal(
    await getCommandURL({ url: secretURL }),
    "https://example.com/account/private"
  )

  const activeTab = await collectActiveTabInfo({})
  assert.equal(activeTab.url, "https://example.com/account/private")
  assert.doesNotMatch(
    JSON.stringify(activeTab),
    /user|password|token|secret|message/
  )
})

test("related-frame page identity keeps only a same-origin sanitized referrer", () => {
  assert.equal(
    getRelatedFrameRuntimePageURL(
      "about:srcdoc",
      "https://user:password@EXAMPLE.com/projects/private?token=secret#message",
      "https://example.com"
    ),
    "https://example.com/projects/private"
  )
  assert.equal(
    getRelatedFrameRuntimePageURL(
      "blob:https://example.com/id",
      "https://attacker.invalid/borrowed-path",
      "https://example.com"
    ),
    "https://example.com/"
  )
  assert.equal(
    getRelatedFrameRuntimePageURL(
      "data:text/html,<p>related</p>",
      "https://EXAMPLE.com/projects/firefox?token=secret#message",
      undefined
    ),
    "https://example.com/projects/firefox"
  )
  assert.equal(
    getRelatedFrameRuntimePageURL("about:blank", "", undefined),
    null
  )
  assert.equal(
    getRelatedFrameRuntimePageURL(
      "https://example.com/regular",
      "https://example.com/referrer",
      "https://example.com"
    ),
    null
  )
})
