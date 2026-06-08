import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_VALUES } from "../../src/config/storage"
import type { FontData } from "../../src/definitions"
import { resolveFontSelection } from "../../src/generators/font-selection"
import { createSystemFontValue } from "../../src/utils/system-fonts"

function createCustomFont(value: string, name = "Runtime Custom"): FontData {
  return {
    data: `data:font/woff2;base64,${Buffer.from(value).toString("base64")}`,
    fileHash: "a".repeat(64),
    name,
    originalFileName: `${name}.woff2`,
    type: "woff2",
    value
  }
}

test("font selection resolver keeps bundled fonts without extra assets", async () => {
  const font = await resolveFontSelection("Estedad-Fontara")

  assert.deepEqual(font, {
    customFontCSS: "",
    fontName: "Estedad-Fontara",
    googleFontCSS: null
  })
})

test("font selection resolver emits only the selected custom font", async () => {
  const selectedFont = createCustomFont("Selected-Fontara", "Selected")
  const ignoredFont = createCustomFont("Ignored-Fontara", "Ignored")
  const font = await resolveFontSelection(selectedFont.value, {
    customFontList: [selectedFont, ignoredFont]
  })

  assert.equal(font.fontName, selectedFont.value)
  assert.match(font.customFontCSS, /font-family: "Selected-Fontara"/)
  assert.doesNotMatch(font.customFontCSS, /Ignored-Fontara/)
  assert.equal(font.googleFontCSS, null)
})

test("font selection resolver falls back when optional font sources are disabled", async () => {
  const systemFontValue = createSystemFontValue("Arial")
  assert.ok(systemFontValue)

  const font = await resolveFontSelection(systemFontValue, {
    systemFontsEnabled: false
  })

  assert.deepEqual(font, {
    customFontCSS: "",
    fontName: DEFAULT_VALUES.SELECTED_FONT,
    googleFontCSS: null
  })
})
