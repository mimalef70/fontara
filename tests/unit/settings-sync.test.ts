import assert from "node:assert/strict"
import test from "node:test"

import { FONTARA_TEXT_UNICODE_RANGE } from "../../src/config/font-unicode-range"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { FontData } from "../../src/definitions"
import {
  createSyncedSettings,
  FONTARA_SETTINGS_UPDATED_AT_KEY,
  mergeSyncedSettingsWithLocalOnlyValues
} from "../../src/utils/settings-sync"

const localCustomFont: FontData = {
  value: "LocalCustom-Fontara",
  name: "Local Custom",
  data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
  type: "woff2",
  fileHash: "a".repeat(64),
  originalFileName: "LocalCustom.woff2",
  unicodeRange: FONTARA_TEXT_UNICODE_RANGE
}

test("settings sync excludes custom font files and custom font references", async () => {
  const syncedSettings = await createSyncedSettings({
    ...DEFAULT_VALUES,
    [STORAGE_KEYS.SELECTED_FONT]: localCustomFont.value,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [localCustomFont],
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: true,
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        enabled: false,
        pattern: "example.com",
        font: localCustomFont.value,
        textStroke: 0.4
      },
      {
        pattern: "fontara.dev",
        font: "Sahel-Fontara"
      }
    ],
    [STORAGE_KEYS.SYNC_SETTINGS]: true
  })

  assert.equal(STORAGE_KEYS.CUSTOM_FONT_LIST in syncedSettings, false)
  assert.equal(STORAGE_KEYS.SELECTED_FONT in syncedSettings, false)
  assert.deepEqual(syncedSettings[STORAGE_KEYS.SITE_PROFILES], [
    {
      enabled: false,
      pattern: "example.com",
      textStroke: 0.4
    },
    {
      pattern: "fontara.dev",
      font: "Sahel-Fontara"
    }
  ])
  assert.equal(syncedSettings[STORAGE_KEYS.CONTEXT_MENUS_ENABLED], true)
  assert.equal(syncedSettings[STORAGE_KEYS.SYNC_SETTINGS], true)
  assert.deepEqual(
    syncedSettings[STORAGE_KEYS.PINNED_WEBSITE_URLS],
    DEFAULT_VALUES.PINNED_WEBSITE_URLS
  )
})

test("settings sync merges synced values with local-only custom fonts", async () => {
  const mergedSettings = await mergeSyncedSettingsWithLocalOnlyValues(
    {
      ...DEFAULT_VALUES,
      [STORAGE_KEYS.SELECTED_FONT]: localCustomFont.value,
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: [localCustomFont],
      [STORAGE_KEYS.SITE_PROFILES]: [
        {
          pattern: "example.com",
          font: localCustomFont.value,
          textStroke: 0.2
        },
        {
          enabled: false,
          pattern: "local-only.example",
          font: localCustomFont.value
        }
      ]
    },
    {
      ...DEFAULT_VALUES,
      [STORAGE_KEYS.SELECTED_FONT]: "Sahel-Fontara",
      [STORAGE_KEYS.PINNED_WEBSITE_URLS]: [
        "https://github.com",
        "https://unknown.example",
        "https://github.com"
      ],
      [STORAGE_KEYS.RTL_ENABLED]: false,
      [STORAGE_KEYS.SITE_PROFILES]: [
        {
          pattern: "example.com",
          textStroke: 0.6
        }
      ],
      [STORAGE_KEYS.SYNC_SETTINGS]: true
    }
  )

  assert.equal(
    mergedSettings[STORAGE_KEYS.SELECTED_FONT],
    localCustomFont.value
  )
  assert.deepEqual(mergedSettings[STORAGE_KEYS.CUSTOM_FONT_LIST], [
    localCustomFont
  ])
  assert.equal(mergedSettings[STORAGE_KEYS.RTL_ENABLED], false)
  assert.deepEqual(mergedSettings[STORAGE_KEYS.PINNED_WEBSITE_URLS], [
    "https://github.com"
  ])
  assert.deepEqual(mergedSettings[STORAGE_KEYS.SITE_PROFILES], [
    {
      pattern: "example.com",
      textStroke: 0.6,
      font: localCustomFont.value
    },
    {
      enabled: false,
      pattern: "local-only.example",
      font: localCustomFont.value
    }
  ])
})

test("settings sync carries the newest internal update timestamp", async () => {
  const updatedAt = 123_456
  const syncedSettings = await createSyncedSettings({
    ...DEFAULT_VALUES,
    [FONTARA_SETTINGS_UPDATED_AT_KEY]: updatedAt,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
  })

  assert.equal(syncedSettings[FONTARA_SETTINGS_UPDATED_AT_KEY], updatedAt)

  const mergedSettings = await mergeSyncedSettingsWithLocalOnlyValues(
    {
      ...DEFAULT_VALUES,
      [FONTARA_SETTINGS_UPDATED_AT_KEY]: updatedAt + 1,
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: []
    },
    {
      ...DEFAULT_VALUES,
      [FONTARA_SETTINGS_UPDATED_AT_KEY]: updatedAt,
      [STORAGE_KEYS.SELECTED_FONT]: "Samim-Fontara"
    }
  )

  assert.equal(mergedSettings[FONTARA_SETTINGS_UPDATED_AT_KEY], updatedAt + 1)
})
