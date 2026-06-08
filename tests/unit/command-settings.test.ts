import assert from "node:assert/strict"
import test from "node:test"

import {
  createToggleCurrentSiteSettings,
  createToggleExtensionSettings
} from "../../src/background/command-settings"
import { STORAGE_KEYS } from "../../src/config/storage"

test("command settings toggle the extension enabled flag", () => {
  assert.deepEqual(
    createToggleExtensionSettings({
      [STORAGE_KEYS.EXTENSION_ENABLED]: true
    }),
    {
      [STORAGE_KEYS.EXTENSION_ENABLED]: false
    }
  )

  assert.deepEqual(
    createToggleExtensionSettings({
      [STORAGE_KEYS.EXTENSION_ENABLED]: false
    }),
    {
      [STORAGE_KEYS.EXTENSION_ENABLED]: true
    }
  )
})

test("command settings enable the current site when site lists are opt-in", () => {
  const update = createToggleCurrentSiteSettings("https://example.com/path", {
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: [],
    [STORAGE_KEYS.WEBSITE_LIST]: []
  })

  assert.deepEqual(update[STORAGE_KEYS.ENABLED_FOR], ["example.com"])
  assert.deepEqual(update[STORAGE_KEYS.DISABLED_FOR], [])
  assert.deepEqual(update[STORAGE_KEYS.WEBSITE_LIST], [
    {
      url: "https://example.com/path",
      regex: "^https?://example\\.com/?.*$",
      isActive: true
    }
  ])
})

test("command settings disable an already active current site", () => {
  const update = createToggleCurrentSiteSettings("https://example.com/path", {
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: ["example.com"],
    [STORAGE_KEYS.WEBSITE_LIST]: [
      {
        url: "https://example.com/path",
        regex: "^https?://example\\.com/?.*$",
        isActive: true
      }
    ]
  })

  assert.deepEqual(update[STORAGE_KEYS.ENABLED_FOR], [])
  assert.deepEqual(update[STORAGE_KEYS.DISABLED_FOR], [])
  assert.deepEqual(update[STORAGE_KEYS.WEBSITE_LIST], [
    {
      url: "https://example.com/path",
      regex: "^https?://example\\.com/?.*$",
      isActive: false
    }
  ])
})
