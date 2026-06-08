import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { DEFAULT_FONTS } from "../../src/config/fonts"
import {
  getLanguageDirection,
  normalizeUILanguagePreference,
  resolveUILanguage,
  UI_LANGUAGE_AUTO
} from "../../src/config/i18n"
import {
  EXTENSION_MESSAGES,
  MESSAGE_CATALOG,
  UI_MESSAGES
} from "../../src/ui/i18n/messages"

test("UI message catalogs cover the same keys for every supported language", () => {
  const englishKeys = Object.keys(UI_MESSAGES.en).sort()

  assert.deepEqual(Object.keys(UI_MESSAGES.fa).sort(), englishKeys)
  assert.deepEqual(Object.keys(UI_MESSAGES.ar).sort(), englishKeys)
  assert.equal(UI_MESSAGES.en["options.nav.general"], "General")
  assert.equal(UI_MESSAGES.fa["options.nav.general"], "عمومی")
  assert.equal(UI_MESSAGES.ar["options.nav.general"], "عام")
  assert.equal(UI_MESSAGES.en["options.nav.advanced"], "Advanced")
  assert.equal(UI_MESSAGES.fa["options.nav.advanced"], "پیشرفته")
  assert.equal(UI_MESSAGES.ar["options.nav.advanced"], "متقدم")
  assert.match(
    UI_MESSAGES.en["options.googleFonts.privacyNotice"],
    /Google Fonts/
  )
  assert.match(UI_MESSAGES.fa["options.googleFonts.privacyNotice"], /IP/)
  assert.match(
    UI_MESSAGES.ar["options.googleFonts.privacyNotice"],
    /Google Fonts/
  )
  assert.equal(UI_MESSAGES.fa["footer.sponsoredBy"], "با حمایت")
})

test("UI language preferences normalize and resolve safely", () => {
  assert.equal(normalizeUILanguagePreference("fa"), "fa")
  assert.equal(normalizeUILanguagePreference("en"), "en")
  assert.equal(normalizeUILanguagePreference("ar"), "ar")
  assert.equal(normalizeUILanguagePreference("de"), UI_LANGUAGE_AUTO)
  assert.equal(resolveUILanguage(UI_LANGUAGE_AUTO, "fa-IR"), "fa")
  assert.equal(resolveUILanguage(UI_LANGUAGE_AUTO, "fa_IR"), "fa")
  assert.equal(resolveUILanguage(UI_LANGUAGE_AUTO, "ar-SA"), "ar")
  assert.equal(resolveUILanguage(UI_LANGUAGE_AUTO, "ar_SA"), "ar")
  assert.equal(resolveUILanguage(UI_LANGUAGE_AUTO, "en-US"), "en")
  assert.equal(resolveUILanguage(UI_LANGUAGE_AUTO, "en_US"), "en")
  assert.equal(resolveUILanguage(UI_LANGUAGE_AUTO, "de-DE"), "en")
  assert.equal(resolveUILanguage("fa", "en-US"), "fa")
  assert.equal(getLanguageDirection("fa"), "rtl")
  assert.equal(getLanguageDirection("ar"), "rtl")
  assert.equal(getLanguageDirection("en"), "ltr")
})

test("bundled font metadata exposes localized display labels", () => {
  assert.ok(
    DEFAULT_FONTS.every(
      (font) =>
        font.localizedName.en &&
        font.localizedAuthor.en &&
        font.localizedName.ar &&
        font.localizedAuthor.ar
    )
  )

  const vazir = DEFAULT_FONTS.find((font) => font.value === "Vazirmatn-Fontara")

  assert.equal(vazir?.name, "وزیر")
  assert.equal(vazir?.localizedName.en, "Vazir")
  assert.equal(vazir?.localizedName.ar, "وزير")
  assert.equal(vazir?.author, "زنده یاد صابر راستی کردار")
  assert.equal(vazir?.localizedAuthor.en, "Saber Rastikerdar")
  assert.equal(vazir?.localizedAuthor.ar, "الراحل صابر راستي كردار")
})

test("extension locales exist for English, Persian, and Arabic", () => {
  const localeCodes = ["en", "fa", "ar"]
  const englishKeys = Object.keys(EXTENSION_MESSAGES.en).sort()

  for (const localeCode of localeCodes) {
    const messages =
      EXTENSION_MESSAGES[localeCode as keyof typeof EXTENSION_MESSAGES]

    assert.deepEqual(Object.keys(messages).sort(), englishKeys)
    assert.ok(messages.extensionName?.message)
    assert.ok(messages.extensionShortName?.message)
    assert.ok(messages.extensionDescription?.message)
  }

  assert.equal(MESSAGE_CATALOG.extension.en, EXTENSION_MESSAGES.en)
})

test("extension locales are generated from the shared i18n catalog", () => {
  const bundleLocalesSource = fs.readFileSync(
    path.resolve("tasks/bundle-locales.js"),
    "utf8"
  )
  const copySource = fs.readFileSync(path.resolve("tasks/copy.js"), "utf8")

  assert.match(bundleLocalesSource, /src\/i18n\/messages\.json/)
  assert.match(bundleLocalesSource, /catalog\.extension/)
  assert.doesNotMatch(copySource, /src\/_locales/)
})
