import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { POPULAR_WEBSITES } from "../../src/config/sites"
import { STORAGE_KEYS } from "../../src/config/storage"
import type { WebsiteItem } from "../../src/definitions"
import {
  createRegexFromUrl,
  getMatchingWebsite,
  isUrlActive
} from "../../src/utils/url"

const originalChrome = (globalThis as any).chrome

afterEach(() => {
  ;(globalThis as any).chrome = originalChrome
})

function mockLocalStorage(values: Record<string, unknown>): void {
  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get(key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ [key]: values[key] })
        }
      }
    }
  }
}

test("popular website regexes match their declared base URLs", () => {
  for (const website of POPULAR_WEBSITES) {
    assert.equal(getMatchingWebsite(`${website.url}/`, [website]), website)
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
