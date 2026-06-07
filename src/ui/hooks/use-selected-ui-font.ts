import { useEffect } from "react"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { FontData } from "../../definitions"
import { createCustomFontFaces } from "../../generators/custom-font-face"
import { formatFontFamilyForCSS } from "../../utils/font-data"
import { decodeSystemFontValue } from "../../utils/system-fonts"
import {
  EMPTY_CUSTOM_FONT_LIST,
  getSystemFontsEnabledInitialValue
} from "../storage-defaults"
import { useStorageValue } from "./use-storage"

const CUSTOM_FONT_STYLE_ID = "fontara-ui-custom-font-styles"

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
  const [systemFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
    getSystemFontsEnabledInitialValue
  )

  useEffect(() => {
    upsertCustomFontStyles(customFontList)
  }, [customFontList])

  useEffect(() => {
    const systemFontFamily = decodeSystemFontValue(selectedFont)
    const fontName =
      systemFontsEnabled && systemFontFamily
        ? systemFontFamily
        : selectedFont || DEFAULT_VALUES.SELECTED_FONT
    document.documentElement.style.setProperty(
      "--fontara-ui-font",
      formatFontFamilyForCSS(fontName)
    )
  }, [selectedFont, systemFontsEnabled])
}
