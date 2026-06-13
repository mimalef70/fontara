import assert from "node:assert/strict"
import test from "node:test"

import {
  formatFontFamilyForCSS,
  getFontDataURLFormat,
  isFontFileSignatureSupported,
  MAX_CUSTOM_FONT_DATA_URL_LENGTH,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  splitFontFamilies
} from "../../src/utils/font-data"

function asciiBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

test("isFontFileSignatureSupported validates known font signatures", () => {
  assert.equal(
    isFontFileSignatureSupported("woff2", asciiBytes("wOF2abc")),
    true
  )
  assert.equal(
    isFontFileSignatureSupported("woff", asciiBytes("wOFFabc")),
    true
  )
  assert.equal(isFontFileSignatureSupported("otf", asciiBytes("OTTOabc")), true)
  assert.equal(
    isFontFileSignatureSupported(
      "ttf",
      new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00])
    ),
    true
  )
  assert.equal(
    isFontFileSignatureSupported("woff2", asciiBytes("not-font")),
    false
  )
  assert.equal(
    isFontFileSignatureSupported("bin", asciiBytes("wOF2abc")),
    false
  )
})

test("getFontDataURLFormat detects common font data URL formats", () => {
  assert.equal(getFontDataURLFormat("data:font/woff2;base64,AAAA"), "woff2")
  assert.equal(getFontDataURLFormat("data:font/woff;base64,AAAA"), "woff")
  assert.equal(getFontDataURLFormat("data:font/otf;base64,AAAA"), "opentype")
  assert.equal(getFontDataURLFormat("data:font/ttf;base64,AAAA"), "truetype")
  assert.equal(
    getFontDataURLFormat("data:application/octet-stream;base64,AAAA", "woff2"),
    "woff2"
  )
})

test("splitFontFamilies preserves quoted font names containing commas", () => {
  assert.deepEqual(
    splitFontFamilies('"Font, With Comma", Arial, sans-serif').map((family) =>
      family.trim()
    ),
    ['"Font, With Comma"', "Arial", "sans-serif"]
  )
})

test("formatFontFamilyForCSS quotes real font names but preserves generic families", () => {
  assert.equal(formatFontFamilyForCSS("Noto Sans Arabic"), '"Noto Sans Arabic"')
  assert.equal(formatFontFamilyForCSS("system-ui"), "system-ui")
  assert.equal(formatFontFamilyForCSS(" sans-serif "), "sans-serif")
  assert.equal(
    formatFontFamilyForCSS('Font "With Quote"'),
    '"Font \\"With Quote\\""'
  )
})

test("custom font storage limits allow larger local font uploads", () => {
  assert.equal(MAX_CUSTOM_FONT_FILE_SIZE_BYTES, 5 * 1024 * 1024)
  assert.ok(MAX_CUSTOM_FONT_DATA_URL_LENGTH > MAX_CUSTOM_FONT_FILE_SIZE_BYTES)
})
