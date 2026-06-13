import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_RTL_SITE_SETTINGS } from "../../src/config/rtl-sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import {
  createSettingsBackup,
  createSettingsBackupFileName,
  createSettingsResetValues,
  FONTARA_SETTINGS_EXPORT_FORMAT,
  FONTARA_SETTINGS_STORAGE_KEYS,
  normalizeSettingsBackup,
  parseSettingsBackupText
} from "../../src/utils/settings-backup"

test("settings backup exports a versioned allowlisted JSON envelope", () => {
  const backup = createSettingsBackup(
    {
      ...DEFAULT_VALUES,
      [STORAGE_KEYS.SELECTED_FONT]: "Sahel-Fontara",
      [STORAGE_KEYS.TEXT_STROKE_ENABLED]: true,
      unknownSetting: "ignored"
    },
    {
      exportedAt: new Date("2026-06-08T10:00:00.000Z"),
      extensionVersion: "4.3.0"
    }
  )

  assert.equal(backup.app, "FontAra")
  assert.equal(backup.format, FONTARA_SETTINGS_EXPORT_FORMAT)
  assert.equal(backup.version, 1)
  assert.equal(backup.exportedAt, "2026-06-08T10:00:00.000Z")
  assert.equal(backup.extensionVersion, "4.3.0")
  assert.deepEqual(Object.keys(backup.settings), [
    ...FONTARA_SETTINGS_STORAGE_KEYS
  ])
  assert.equal(backup.settings[STORAGE_KEYS.SELECTED_FONT], "Sahel-Fontara")
  assert.equal("unknownSetting" in backup.settings, false)
  assert.equal(STORAGE_KEYS.TEXT_STROKE_ENABLED in backup.settings, false)
  assert.equal(
    createSettingsBackupFileName(new Date("2026-06-08T10:00:00.000Z")),
    "fontara-settings-2026-06-08.json"
  )
})

test("settings backup parser accepts FontAra envelopes and rejects invalid files", () => {
  const backup = createSettingsBackup({
    [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara"
  })
  const parsed = parseSettingsBackupText(JSON.stringify(backup))
  const legacyParsed = parseSettingsBackupText(
    JSON.stringify({
      ...backup,
      app: "FontARA"
    })
  )

  assert.equal(parsed.version, 1)
  assert.equal(parsed.settings[STORAGE_KEYS.SELECTED_FONT], "Vazirmatn-Fontara")
  assert.equal(legacyParsed.version, 1)
  assert.equal(
    legacyParsed.settings[STORAGE_KEYS.SELECTED_FONT],
    "Vazirmatn-Fontara"
  )
  assert.throws(() => parseSettingsBackupText("{"), /invalid-json/)
  assert.throws(
    () => parseSettingsBackupText(JSON.stringify({ settings: {} })),
    /invalid-settings-backup/
  )
  assert.throws(
    () =>
      parseSettingsBackupText(
        JSON.stringify({
          app: "Other Extension",
          format: FONTARA_SETTINGS_EXPORT_FORMAT,
          version: 1,
          settings: {
            [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara"
          }
        })
      ),
    /unsupported-settings-backup/
  )
  assert.throws(
    () =>
      parseSettingsBackupText(
        JSON.stringify({
          app: "FontAra",
          format: FONTARA_SETTINGS_EXPORT_FORMAT,
          version: 999,
          settings: {
            [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara"
          }
        })
      ),
    /unsupported-settings-backup/
  )
})

test("settings backup import normalizes settings before storage writes", async () => {
  const normalized = await normalizeSettingsBackup({
    [STORAGE_KEYS.EXTENSION_ENABLED]: false,
    [STORAGE_KEYS.SELECTED_FONT]: "RemovedCustom-Fontara",
    [STORAGE_KEYS.WEBSITE_LIST]: [
      {
        url: "https://example.com/path",
        regex: "^https://example\\.com/.*$",
        isActive: false
      },
      {
        url: "https://bad-regex.example",
        regex: "("
      }
    ],
    [STORAGE_KEYS.PINNED_WEBSITE_URLS]: [
      "https://github.com",
      "https://unknown.example",
      " https://github.com ",
      "https://chatgpt.com"
    ],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
    [STORAGE_KEYS.ENABLED_FOR]: ["Example.com/path", "www.example.com/path"],
    [STORAGE_KEYS.DISABLED_FOR]: [" https://ignored.example/ "],
    [STORAGE_KEYS.SITE_PROFILES]: [
      {
        pattern: "example.com",
        font: "RemovedCustom-Fontara",
        textStroke: 0.4
      }
    ],
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: [
      {
        value: "ValidCustom-Fontara",
        name: " Valid Custom ",
        data: `data:application/octet-stream;base64,${Buffer.from("font").toString("base64")}`,
        type: "woff2"
      },
      {
        value: "Unsafe Custom Font",
        name: "Unsafe",
        data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
        type: "woff2"
      }
    ],
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: "yes",
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: true,
    [STORAGE_KEYS.TEXT_STROKE]: 2,
    [STORAGE_KEYS.UI_LANGUAGE]: "de",
    [STORAGE_KEYS.RTL_ENABLED]: false,
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: {
      chatgpt: false,
      unknown: false
    },
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: true,
    [STORAGE_KEYS.SYNC_SETTINGS]: false,
    unknownSetting: "ignored"
  })

  assert.equal(normalized.importedKeyCount, 17)
  assert.equal(normalized.ignoredKeyCount, 1)
  assert.equal(normalized.settings[STORAGE_KEYS.EXTENSION_ENABLED], false)
  assert.equal(
    normalized.settings[STORAGE_KEYS.SELECTED_FONT],
    DEFAULT_VALUES.SELECTED_FONT
  )
  assert.equal(normalized.settings[STORAGE_KEYS.GOOGLE_FONTS_ENABLED], false)
  assert.equal(normalized.settings[STORAGE_KEYS.SYSTEM_FONTS_ENABLED], true)
  assert.equal(normalized.settings[STORAGE_KEYS.TEXT_STROKE], 1)
  assert.equal(normalized.settings[STORAGE_KEYS.UI_LANGUAGE], "auto")
  assert.equal(normalized.settings[STORAGE_KEYS.RTL_ENABLED], false)
  assert.equal(normalized.settings[STORAGE_KEYS.CONTEXT_MENUS_ENABLED], true)
  assert.equal(normalized.settings[STORAGE_KEYS.SYNC_SETTINGS], false)
  assert.deepEqual(normalized.settings[STORAGE_KEYS.PINNED_WEBSITE_URLS], [
    "https://github.com",
    "https://chatgpt.com"
  ])
  assert.deepEqual(normalized.settings[STORAGE_KEYS.RTL_SITE_SETTINGS], {
    ...DEFAULT_RTL_SITE_SETTINGS,
    chatgpt: false
  })

  const customFonts = normalized.settings[
    STORAGE_KEYS.CUSTOM_FONT_LIST
  ] as unknown[]
  assert.equal(customFonts.length, 1)
  assert.match(
    (customFonts[0] as { data: string }).data,
    /^data:font\/woff2;base64,/
  )
  assert.equal((customFonts[0] as { name: string }).name, "Valid Custom")
  assert.equal((customFonts[0] as { fileHash: string }).fileHash.length, 64)

  const siteProfiles = normalized.settings[
    STORAGE_KEYS.SITE_PROFILES
  ] as unknown[]
  assert.deepEqual(siteProfiles, [
    {
      pattern: "example.com",
      textStroke: 0.4
    }
  ])
})

test("settings backup import supports legacy raw storage snapshots", async () => {
  const parsed = parseSettingsBackupText(
    JSON.stringify({
      [STORAGE_KEYS.TEXT_STROKE_ENABLED]: true,
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara"
    })
  )
  const normalized = await normalizeSettingsBackup(parsed.settings)

  assert.equal(parsed.version, null)
  assert.equal(normalized.importedKeyCount, 1)
  assert.equal(normalized.settings[STORAGE_KEYS.TEXT_STROKE], 0.3)
})

test("settings reset values restore the exported settings defaults", async () => {
  assert.deepEqual(await createSettingsResetValues(), {
    [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.PINNED_WEBSITE_URLS]: DEFAULT_VALUES.PINNED_WEBSITE_URLS,
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: DEFAULT_VALUES.ENABLED_BY_DEFAULT,
    [STORAGE_KEYS.ENABLED_FOR]: DEFAULT_VALUES.ENABLED_FOR,
    [STORAGE_KEYS.DISABLED_FOR]: DEFAULT_VALUES.DISABLED_FOR,
    [STORAGE_KEYS.SITE_PROFILES]: DEFAULT_VALUES.SITE_PROFILES,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: DEFAULT_VALUES.CUSTOM_FONT_LIST,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: DEFAULT_VALUES.GOOGLE_FONTS_ENABLED,
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: DEFAULT_VALUES.SYSTEM_FONTS_ENABLED,
    [STORAGE_KEYS.TEXT_STROKE]: DEFAULT_VALUES.TEXT_STROKE,
    [STORAGE_KEYS.UI_LANGUAGE]: DEFAULT_VALUES.UI_LANGUAGE,
    [STORAGE_KEYS.RTL_ENABLED]: DEFAULT_VALUES.RTL_ENABLED,
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: DEFAULT_VALUES.RTL_SITE_SETTINGS,
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: DEFAULT_VALUES.CONTEXT_MENUS_ENABLED,
    [STORAGE_KEYS.SYNC_SETTINGS]: DEFAULT_VALUES.SYNC_SETTINGS
  })
})
