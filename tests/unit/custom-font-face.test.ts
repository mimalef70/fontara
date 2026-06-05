import assert from "node:assert/strict"
import test from "node:test"

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
