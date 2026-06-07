import { useEffect } from "react"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { FontData } from "../../definitions"
import { createCustomFontFaces } from "../../generators/custom-font-face"
import { formatFontFamilyForCSS } from "../../utils/font-data"
import {
  decodeGoogleFontValue,
  loadGoogleFontFaceCSS
} from "../../utils/google-font-runtime"
import { decodeSystemFontValue } from "../../utils/system-fonts"
import {
  EMPTY_CUSTOM_FONT_LIST,
  getGoogleFontsEnabledInitialValue,
  getSystemFontsEnabledInitialValue
} from "../storage-defaults"
import { useStorageValue } from "./use-storage"

const CUSTOM_FONT_STYLE_ID = "fontara-ui-custom-font-styles"
const GOOGLE_FONT_STYLE_ID = "fontara-ui-google-font-styles"

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

function upsertGoogleFontStyles(css: string | null): void {
  const existingStyle = document.getElementById(GOOGLE_FONT_STYLE_ID)

  if (!css) {
    existingStyle?.remove()
    return
  }

  const styleElement =
    existingStyle instanceof HTMLStyleElement
      ? existingStyle
      : document.createElement("style")

  styleElement.id = GOOGLE_FONT_STYLE_ID
  styleElement.textContent = css

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
  const [googleFontsEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.GOOGLE_FONTS_ENABLED,
    getGoogleFontsEnabledInitialValue
  )

  useEffect(() => {
    upsertCustomFontStyles(customFontList)
  }, [customFontList])

  useEffect(() => {
    let cancelled = false
    const systemFontFamily = decodeSystemFontValue(selectedFont)
    const googleFontFamily = decodeGoogleFontValue(selectedFont)

    if (googleFontFamily && googleFontsEnabled) {
      document.documentElement.style.setProperty(
        "--fontara-ui-font",
        formatFontFamilyForCSS(googleFontFamily)
      )

      loadGoogleFontFaceCSS(selectedFont).then((css) => {
        if (!cancelled) {
          upsertGoogleFontStyles(css)
        }
      })

      return () => {
        cancelled = true
      }
    }

    upsertGoogleFontStyles(null)
    const fontName =
      systemFontsEnabled && systemFontFamily
        ? systemFontFamily
        : googleFontFamily
          ? DEFAULT_VALUES.SELECTED_FONT
          : selectedFont || DEFAULT_VALUES.SELECTED_FONT
    document.documentElement.style.setProperty(
      "--fontara-ui-font",
      formatFontFamilyForCSS(fontName)
    )
    return () => {
      cancelled = true
    }
  }, [googleFontsEnabled, selectedFont, systemFontsEnabled])
}
