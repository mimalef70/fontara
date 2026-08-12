import { useEffect } from "react"

import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { CustomFontFamily } from "../../custom-font-types"
import { createGoogleFontBinaryFamilyKey } from "../../google-font-binary-types"
import {
  activatePreparedLocalFontFamily,
  prepareLocalFontFamily
} from "../../inject/local-font-manager"
import { formatFontFamilyForCSS } from "../../utils/font-data"
import { getLatestGoogleFontBinaryFamily } from "../../utils/google-font-binary-storage"
import { decodeGoogleFontValue } from "../../utils/google-fonts"
import {
  decodeSystemFontValue,
  isSystemFontAccessSupported,
  loadSystemFonts,
  normalizeSystemFontFamilyKey
} from "../../utils/system-fonts"
import {
  EMPTY_CUSTOM_FONT_LIST,
  getGoogleFontsEnabledInitialValue,
  getSystemFontsEnabledInitialValue
} from "../storage-defaults"
import { useStorageValue } from "./use-storage"

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
        ? {
            revision: customFont.revision,
            source: "custom" as const,
            value: customFont.value
          }
        : null
      const customFontReady = await prepareLocalFontFamily(customFontReference)
      if (cancelled) return

      if (customFont && customFontReady) {
        document.documentElement.style.setProperty(
          "--fontara-ui-font",
          formatFontFamilyForCSS(customFont.value)
        )
        activatePreparedLocalFontFamily(customFontReference)
        return
      }

      if (googleFontFamily && googleFontsEnabled) {
        const family = await getLatestGoogleFontBinaryFamily(
          await createGoogleFontBinaryFamilyKey(googleFontFamily),
          { touch: false }
        )
        const reference = family
          ? {
              key: family.key,
              revision: family.revision,
              source: "google" as const
            }
          : null
        const ready = reference
          ? await prepareLocalFontFamily(reference)
          : false
        if (cancelled) return

        if (family && reference && ready) {
          document.documentElement.style.setProperty(
            "--fontara-ui-font",
            formatFontFamilyForCSS(family.runtimeFamily)
          )
          activatePreparedLocalFontFamily(reference)
          return
        }
      }

      let systemFontAvailable = Boolean(systemFontFamily)
      if (
        systemFontsEnabled &&
        systemFontFamily &&
        isSystemFontAccessSupported()
      ) {
        const state = await loadSystemFonts()
        if (cancelled) return
        systemFontAvailable =
          state.status !== "ready" ||
          state.fonts.some(
            (font) =>
              normalizeSystemFontFamilyKey(font.fontFamily) ===
              normalizeSystemFontFamilyKey(systemFontFamily)
          )
      }
      const fontName =
        systemFontsEnabled && systemFontFamily && systemFontAvailable
          ? systemFontFamily
          : googleFontFamily || customFont
            ? DEFAULT_VALUES.SELECTED_FONT
            : selectedFont || DEFAULT_VALUES.SELECTED_FONT
      document.documentElement.style.setProperty(
        "--fontara-ui-font",
        formatFontFamilyForCSS(fontName)
      )
      activatePreparedLocalFontFamily(null)
    })()

    return () => {
      cancelled = true
    }
  }, [customFontList, googleFontsEnabled, selectedFont, systemFontsEnabled])
}
