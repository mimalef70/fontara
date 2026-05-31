import { useEffect } from "react"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { FontData } from "../../definitions"
import { createCustomFontFaces } from "../../generators/custom-font-face"
import { escapeCSSString } from "../../utils/font-data"
import { useStorageValue } from "./use-storage"

const CUSTOM_FONT_STYLE_ID = "fontara-ui-custom-font-styles"
const EMPTY_CUSTOM_FONT_LIST: FontData[] = []

function upsertCustomFontStyles(customFontList: FontData[]): void {
  const customFontFaces = createCustomFontFaces(customFontList)
  const existingStyle = document.getElementById(CUSTOM_FONT_STYLE_ID)

  if (!customFontFaces) {
    existingStyle?.remove()
    return
  }

  const styleElement =
    existingStyle instanceof HTMLStyleElement
      ? existingStyle
      : document.createElement("style")

  styleElement.id = CUSTOM_FONT_STYLE_ID
  styleElement.textContent = customFontFaces

  if (!styleElement.parentElement) {
    document.head.appendChild(styleElement)
  }
}

export function useSelectedUIFont(): void {
  const [selectedFont] = useStorageValue<string>(
    STORAGE_KEYS.SELECTED_FONT,
    DEFAULT_VALUES.SELECTED_FONT
  )
  const [customFontList] = useStorageValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST,
    EMPTY_CUSTOM_FONT_LIST
  )

  useEffect(() => {
    upsertCustomFontStyles(customFontList)
  }, [customFontList])

  useEffect(() => {
    const fontName = selectedFont || DEFAULT_VALUES.SELECTED_FONT
    document.documentElement.style.setProperty(
      "--fontara-ui-font",
      `"${escapeCSSString(fontName)}"`
    )
  }, [selectedFont])
}
