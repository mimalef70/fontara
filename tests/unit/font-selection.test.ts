import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_VALUES } from "../../src/config/storage"
import type { CustomFontFamily } from "../../src/custom-font-types"
import { resolveFontSelection } from "../../src/generators/font-selection"
import { createSystemFontValue } from "../../src/utils/system-fonts"

function createCustomFont(
  value: string,
  name = "Runtime Custom"
): CustomFontFamily {
  return {
    value,
    displayName: name,
    sourceFamilyKey: name.toLowerCase(),
    unicodeRange: null,
    revision: 3,
    faces: [
      {
        id: `${value}-face`,
        fileHash: "a".repeat(64),
        fileName: `${name}.woff2`,
        format: "woff2",
        byteLength: 4,
        weight: { min: 400, max: 400 },
        style: "normal",
        stretch: { min: 100, max: 100 },
        axes: [],
        validation: "verified"
      }
    ]
  }
}

test("font selection resolver keeps bundled fonts without extra assets", async () => {
  const font = await resolveFontSelection("Estedad-Fontara")

  assert.deepEqual(font, {
    customFontFamilyRevision: null,
    customFontFamilyValue: null,
    fontName: "Estedad-Fontara",
    googleFontCSS: null
  })
})

test("font selection resolver emits only selected custom family metadata", async () => {
  const selectedFont = createCustomFont("Selected-Fontara", "Selected")
  const ignoredFont = createCustomFont("Ignored-Fontara", "Ignored")
  const font = await resolveFontSelection(selectedFont.value, {
    customFontList: [selectedFont, ignoredFont]
  })

  assert.equal(font.fontName, selectedFont.value)
  assert.equal(font.customFontFamilyValue, selectedFont.value)
  assert.equal(font.customFontFamilyRevision, selectedFont.revision)
  assert.equal(font.googleFontCSS, null)
})

test("font selection resolver falls back when optional font sources are disabled", async () => {
  const systemFontValue = createSystemFontValue("Arial")
  assert.ok(systemFontValue)

  const font = await resolveFontSelection(systemFontValue, {
    systemFontsEnabled: false
  })

  assert.deepEqual(font, {
    customFontFamilyRevision: null,
    customFontFamilyValue: null,
    fontName: DEFAULT_VALUES.SELECTED_FONT,
    googleFontCSS: null
  })
})
