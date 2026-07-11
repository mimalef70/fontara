import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizeCustomFontFamilyKey,
  normalizeCustomFontFileName,
  normalizeCustomFontText
} from "../../src/utils/custom-font-name"
import { normalizeCustomFontFamily } from "../../src/utils/custom-font-normalization"

test("custom font names preserve real scripts while removing spoofing controls", () => {
  const name = "  خانواده\u200cی ✦ 😀\u202e\u2066\u200b\n ۲۰۲۶  "

  assert.equal(normalizeCustomFontText(name), "خانواده\u200cی ✦ 😀 ۲۰۲۶")
  assert.equal(
    normalizeCustomFontFamilyKey("  Ｆｏｎｔ   FAMILY  "),
    "font family"
  )
  assert.equal(
    normalizeCustomFontFileName("  ایران\u202e یکان.woff2  ", "font.woff2"),
    "ایران یکان.woff2"
  )
})

test("custom font name limits never split a surrogate pair", () => {
  const normalized = normalizeCustomFontText("😀".repeat(140))

  assert.equal(Array.from(normalized).length, 128)
  assert.equal(normalized, "😀".repeat(128))
})

test("stored custom font metadata is sanitized at the background boundary", () => {
  const family = normalizeCustomFontFamily({
    value: "SafeAlias-Fontara",
    displayName: "  فونت\u202e امن  ",
    sourceFamilyKey: "  ＳＡＦＥ   FAMILY  ",
    unicodeRange: null,
    revision: 1,
    faces: [
      {
        id: "safe-face",
        fileHash: "a".repeat(64),
        fileName: "\u202e\u2066",
        format: "woff2",
        byteLength: 4,
        weight: { min: 400, max: 400 },
        style: "normal",
        stretch: { min: 100, max: 100 },
        axes: [],
        validation: "verified"
      }
    ]
  })

  assert.equal(family?.displayName, "فونت امن")
  assert.equal(family?.sourceFamilyKey, "safe family")
  assert.equal(family?.faces[0].fileName, "font.woff2")
})
