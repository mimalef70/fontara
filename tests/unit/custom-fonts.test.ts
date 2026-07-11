import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { CustomFontFamily } from "../../src/custom-font-types"
import { createCustomFontDeletionUpdate } from "../../src/utils/custom-fonts"

function createFamily(
  value: string,
  displayName: string,
  hashCharacter: string
): CustomFontFamily {
  return {
    value,
    displayName,
    sourceFamilyKey: displayName.toLowerCase(),
    unicodeRange: null,
    revision: 1,
    faces: [
      {
        id: `${hashCharacter}-face`,
        fileHash: hashCharacter.repeat(64),
        fileName: `${displayName}.woff2`,
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

const customFonts = [
  createFamily("SelectedCustom-Fontara", "Selected Custom", "a"),
  createFamily("OtherCustom-Fontara", "Other Custom", "b")
]

test("deleting the selected custom font resets selection to the default font", () => {
  assert.deepEqual(
    createCustomFontDeletionUpdate(
      customFonts,
      "SelectedCustom-Fontara",
      "SelectedCustom-Fontara"
    ),
    {
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: [customFonts[1]],
      [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT
    }
  )
})

test("deleting an unselected custom font preserves the selected font", () => {
  assert.deepEqual(
    createCustomFontDeletionUpdate(
      customFonts,
      "OtherCustom-Fontara",
      "SelectedCustom-Fontara"
    ),
    {
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: [customFonts[0]]
    }
  )
})

test("deleting a custom font removes only matching per-site font overrides", () => {
  assert.deepEqual(
    createCustomFontDeletionUpdate(
      customFonts,
      "SelectedCustom-Fontara",
      "OtherCustom-Fontara",
      [
        {
          font: "SelectedCustom-Fontara",
          pattern: "chatgpt.com",
          textStroke: 0.4
        },
        {
          font: "SelectedCustom-Fontara",
          pattern: "github.com"
        },
        {
          font: "OtherCustom-Fontara",
          pattern: "example.com"
        }
      ]
    ),
    {
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: [customFonts[1]],
      [STORAGE_KEYS.SITE_PROFILES]: [
        {
          pattern: "chatgpt.com",
          textStroke: 0.4
        },
        {
          font: "OtherCustom-Fontara",
          pattern: "example.com"
        }
      ]
    }
  )
})
