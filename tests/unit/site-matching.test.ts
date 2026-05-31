import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test, { afterEach } from "node:test"

import { POPULAR_WEBSITES } from "../../src/config/sites"
import { STORAGE_KEYS } from "../../src/config/storage"
import type { WebsiteItem } from "../../src/definitions"
import {
  createRegexFromUrl,
  getMatchingWebsite,
  isUrlActive
} from "../../src/utils/url"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

function mockLocalStorage(values: Record<string, unknown>): void {
  Reflect.set(globalThis, "chrome", {
    storage: {
      local: {
        get(key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ [key]: values[key] })
        }
      }
    }
  })
}

test("popular website regexes match their declared base URLs", () => {
  for (const website of POPULAR_WEBSITES) {
    assert.equal(getMatchingWebsite(`${website.url}/`, [website]), website)
  }
})

test("popular website icons point to existing assets", () => {
  for (const website of POPULAR_WEBSITES) {
    assert.ok(website.icon, `${website.siteName} should declare an icon`)
    assert.ok(
      fs.existsSync(path.resolve(website.icon)),
      `${website.siteName} icon is missing: ${website.icon}`
    )
  }
})

test("custom URL regex matches the same host over http and https", () => {
  const regex = createRegexFromUrl("https://example.com/path")
  const customWebsite: WebsiteItem = {
    url: "https://example.com/path",
    regex,
    isActive: true
  }

  assert.equal(
    getMatchingWebsite("https://example.com/anything", [customWebsite]),
    customWebsite
  )
  assert.equal(
    getMatchingWebsite("http://example.com/anything", [customWebsite]),
    customWebsite
  )
  assert.equal(
    getMatchingWebsite("https://sub.example.com/", [customWebsite]),
    null
  )
})

test("custom URL regex escapes host metacharacters", () => {
  const regex = createRegexFromUrl("http://[::1]/path")
  const customWebsite: WebsiteItem = {
    url: "http://[::1]/path",
    regex,
    isActive: true
  }

  assert.equal(
    getMatchingWebsite("http://[::1]/anything", [customWebsite]),
    customWebsite
  )
})

test("isUrlActive falls back to default websites when local storage is empty", async () => {
  mockLocalStorage({})

  assert.equal(await isUrlActive(`${POPULAR_WEBSITES[0].url}/`), true)
})

test("isUrlActive respects the global disabled flag", async () => {
  mockLocalStorage({
    [STORAGE_KEYS.EXTENSION_ENABLED]: false
  })

  assert.equal(await isUrlActive(`${POPULAR_WEBSITES[0].url}/`), false)
})
