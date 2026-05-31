import assert from "node:assert/strict"
import test from "node:test"

import { mergeWebsiteLists } from "../../src/background/storage-manager"
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
