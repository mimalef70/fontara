import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { FontData } from "../../src/definitions"
import {
  createSyncedSettings,
  mergeSyncedSettingsWithLocalOnlyValues
} from "../../src/utils/settings-sync"

const localCustomFont: FontData = {
  value: "LocalCustom-Fontara",
  name: "Local Custom",
  data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
  type: "woff2",
  fileHash: "a".repeat(64),
  originalFileName: "LocalCustom.woff2"
}

test("settings sync excludes custom font files and custom font references", async () => {
  const syncedSettings = await createSyncedSettings({
    ...DEFAULT_VALUES,
    [STORAGE_KEYS.SELECTED_FONT]: localCustomFont.value,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [localCustomFont],
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: true,
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
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
          pattern: "local-only.example",
          font: localCustomFont.value
        }
      ]
    },
    {
      ...DEFAULT_VALUES,
      [STORAGE_KEYS.SELECTED_FONT]: "Sahel-Fontara",
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
  assert.deepEqual(mergedSettings[STORAGE_KEYS.SITE_PROFILES], [
    {
      pattern: "example.com",
      textStroke: 0.6,
      font: localCustomFont.value
    },
    {
      pattern: "local-only.example",
      font: localCustomFont.value
    }
  ])
})
