import assert from "node:assert/strict"
import test from "node:test"

import {
  createCustomFontFaces,
  detectFontFormat
} from "../../src/generators/custom-font-face"

test("detectFontFormat detects common font data URL formats", () => {
  assert.equal(detectFontFormat("data:font/woff2;base64,AAAA"), "woff2")
  assert.equal(detectFontFormat("data:font/woff;base64,AAAA"), "woff")
  assert.equal(detectFontFormat("data:font/otf;base64,AAAA"), "opentype")
  assert.equal(detectFontFormat("data:font/ttf;base64,AAAA"), "truetype")
})

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
