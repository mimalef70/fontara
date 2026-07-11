import { useEffect } from "react"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { CustomFontFamily } from "../../custom-font-types"
import {
  activatePreparedCustomFontFamily,
  prepareCustomFontFamily
} from "../../inject/custom-font-manager"
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

const GOOGLE_FONT_STYLE_ID = "fontara-ui-google-font-styles"

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
  const [customFontList] = useStorageValue<CustomFontFamily[]>(
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
    let cancelled = false
    const systemFontFamily = decodeSystemFontValue(selectedFont)
    const googleFontFamily = decodeGoogleFontValue(selectedFont)
    const customFont = customFontList.find(
      (family) => family.value === selectedFont
    )

    void (async () => {
      const customFontReference = customFont
        ? { value: customFont.value, revision: customFont.revision }
        : null
      const customFontReady = await prepareCustomFontFamily(customFontReference)
      if (cancelled) return

      if (customFont && customFontReady) {
        upsertGoogleFontStyles(null)
        document.documentElement.style.setProperty(
          "--fontara-ui-font",
          formatFontFamilyForCSS(customFont.value)
        )
        activatePreparedCustomFontFamily(customFontReference)
        return
      }

      if (googleFontFamily && googleFontsEnabled) {
        document.documentElement.style.setProperty(
          "--fontara-ui-font",
          formatFontFamilyForCSS(googleFontFamily)
        )
        activatePreparedCustomFontFamily(null)

        const css = await loadGoogleFontFaceCSS(selectedFont)
        if (!cancelled) upsertGoogleFontStyles(css)
        return
      }

      upsertGoogleFontStyles(null)
      const fontName =
        systemFontsEnabled && systemFontFamily
          ? systemFontFamily
          : googleFontFamily || customFont
            ? DEFAULT_VALUES.SELECTED_FONT
            : selectedFont || DEFAULT_VALUES.SELECTED_FONT
      document.documentElement.style.setProperty(
        "--fontara-ui-font",
        formatFontFamilyForCSS(fontName)
      )
      activatePreparedCustomFontFamily(null)
    })()

    return () => {
      cancelled = true
    }
  }, [customFontList, googleFontsEnabled, selectedFont, systemFontsEnabled])
}
