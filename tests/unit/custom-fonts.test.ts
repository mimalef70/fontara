import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../src/config/storage"
import type { FontData } from "../../src/definitions"
import { createCustomFontDeletionUpdate } from "../../src/utils/custom-fonts"

const customFonts: FontData[] = [
  {
    value: "SelectedCustom-Fontara",
    name: "Selected Custom",
    data: `data:font/woff2;base64,${Buffer.from("font").toString("base64")}`,
    type: "woff2",
    fileHash: "a".repeat(64),
    originalFileName: "selected.woff2"
  },
  {
    value: "OtherCustom-Fontara",
    name: "Other Custom",
    data: `data:font/woff2;base64,${Buffer.from("other").toString("base64")}`,
    type: "woff2",
    fileHash: "b".repeat(64),
    originalFileName: "other.woff2"
  }
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
