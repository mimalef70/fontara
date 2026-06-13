import assert from "node:assert/strict"
import test from "node:test"

import { FONTARA_TEXT_UNICODE_RANGE } from "../../src/config/font-unicode-range"
import { createCustomFontFaces } from "../../src/generators/custom-font-face"

test("createCustomFontFaces creates reusable font-face CSS", () => {
  const css = createCustomFontFaces([
    {
      value: "CustomFont-Fontara",
      name: "Custom Font",
      data: "data:font/woff2;base64,AAAA",
      fileHash: "abc123",
      originalFileName: "custom.woff2",
      type: "woff2"
    }
  ])

  assert.match(css, /font-family: "CustomFont-Fontara"/)
  assert.match(css, /format\("woff2"\)/)
  assert.match(css, /font-display: swap/)
  assert.ok(css.includes(`unicode-range: ${FONTARA_TEXT_UNICODE_RANGE};`))
})

test("createCustomFontFaces uses selected custom unicode ranges", () => {
  const css = createCustomFontFaces([
    {
      value: "LatinCustom-Fontara",
      name: "Latin Custom",
      data: "data:font/woff2;base64,AAAA",
      fileHash: "abc123",
      originalFileName: "latin.woff2",
      type: "woff2",
      unicodeRange: "U+0000-00FF U+0100-024F"
    }
  ])

  assert.match(css, /font-family: "LatinCustom-Fontara"/)
  assert.match(css, /unicode-range: U\+0000-00FF, U\+0100-024F;/)
})

test("createCustomFontFaces can omit unicode-range for all text", () => {
  const css = createCustomFontFaces([
    {
      value: "AllTextCustom-Fontara",
      name: "All Text Custom",
      data: "data:font/woff2;base64,AAAA",
      fileHash: "abc123",
      originalFileName: "all.woff2",
      type: "woff2",
      unicodeRange: null
    }
  ])

  assert.match(css, /font-family: "AllTextCustom-Fontara"/)
  assert.doesNotMatch(css, /unicode-range:/)
})

test("createCustomFontFaces normalizes generic font data URL MIME types", () => {
  const css = createCustomFontFaces([
    {
      value: "GenericMimeCustom-Fontara",
      name: "Generic MIME Custom",
      data: "data:application/octet-stream;base64,AAAA",
      fileHash: "abc123",
      originalFileName: "generic.woff2",
      type: "woff2"
    }
  ])

  assert.match(css, /font-family: "GenericMimeCustom-Fontara"/)
  assert.match(css, /url\("data:font\/woff2;base64,AAAA"\)/)
  assert.match(css, /format\("woff2"\)/)
})

test("createCustomFontFaces skips unsafe custom font records", () => {
  const css = createCustomFontFaces([
    {
      value: 'Bad"-Fontara',
      name: "Bad Font",
      data: "data:font/woff2;base64,AAAA",
      fileHash: "abc123",
      originalFileName: "bad.woff2",
      type: "woff2"
    },
    {
      value: "InvalidData-Fontara",
      name: "Invalid Data",
      data: "data:text/plain;base64,AAAA",
      fileHash: "def456",
      originalFileName: "invalid.woff2",
      type: "woff2"
    },
    {
      value: "GenericMimeWithoutType-Fontara",
      name: "Generic MIME Without Type",
      data: "data:application/octet-stream;base64,AAAA",
      fileHash: "ghi789",
      originalFileName: "invalid.bin",
      type: "bin"
    }
  ])

  assert.equal(css, "")
})
