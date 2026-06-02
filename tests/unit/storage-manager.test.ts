import assert from "node:assert/strict"
import test from "node:test"

import {
  mergeWebsiteLists,
  normalizeCustomFontList
} from "../../src/background/storage-manager"
import type { WebsiteItem } from "../../src/definitions"

test("mergeWebsiteLists appends new default sites", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://example.com",
      regex: "^https://example\\.com/.*$",
      isActive: true
    }
  ]
  const defaultList: WebsiteItem[] = [
    ...existingList,
    {
      url: "https://new.example.com",
      regex: "^https://new\\.example\\.com/.*$",
      isActive: true
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), defaultList)
})

test("mergeWebsiteLists updates versioned defaults and preserves active state", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://web.whatsapp.com",
      regex: "^https://web\\.whatsapp\\.com/.*$",
      isActive: false,
      version: "4.0.0"
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://web.whatsapp.com",
      regex: "^https://web\\.whatsapp\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.1.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades ChatGPT to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://chatgpt.com",
      regex: "^https://chatgpt\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://chatgpt.com",
      regex: "^https://chatgpt\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades X to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://x.com",
      regex: "^https://x\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://x.com",
      regex: "^https://x\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades LinkedIn to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://www.linkedin.com",
      regex: "^https://[^/]*linkedin\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://www.linkedin.com",
      regex: "^https://[^/]*linkedin\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("mergeWebsiteLists upgrades Gemini to CSS-only defaults", () => {
  const existingList: WebsiteItem[] = [
    {
      url: "https://gemini.google.com",
      regex: "^https://gemini\\.google\\.com/.*$",
      isActive: false
    }
  ]
  const defaultList: WebsiteItem[] = [
    {
      url: "https://gemini.google.com",
      regex: "^https://gemini\\.google\\.com/.*$",
      isActive: true,
      customCss: true,
      version: "4.2.1"
    }
  ]

  assert.deepEqual(mergeWebsiteLists(existingList, defaultList), [
    {
      ...defaultList[0],
      isActive: false
    }
  ])
})

test("normalizeCustomFontList backfills missing file hashes", async () => {
  const [font] = await normalizeCustomFontList([
    {
      value: "LegacyCustom-Fontara",
      name: "Legacy Custom",
      data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2",
      originalFileName: "legacy.woff2"
    }
  ])

  assert.equal(font.fileHash.length, 64)
  assert.equal(font.originalFileName, "legacy.woff2")
})

test("normalizeCustomFontList rejects unsafe custom font records", async () => {
  const fonts = await normalizeCustomFontList([
    {
      value: 'Bad"-Fontara',
      name: "Bad Font",
      data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2"
    },
    {
      value: "InvalidData-Fontara",
      name: "Invalid Data",
      data: `data:text/plain;base64,${Buffer.from("font").toString("base64")}`,
      type: "woff2"
    }
  ])

  assert.deepEqual(fonts, [])
})
