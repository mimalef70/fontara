import type { FontaraFontThemeCommandData } from "../definitions"
import { formatFontFamilyForCSS } from "../utils/font-data"
import {
  refreshEditableFontStyles,
  removeEditableFontStyles
} from "./editable-font-style"
import { getDocumentAndShadowStyleRoots } from "./shadow-roots"
import { removeStyle, upsertStyle } from "./style-utils"

const FONT_STYLES_ID = "fontara-font-styles"
const CUSTOM_CSS_ID = "fontara-custom-css-style"
const CUSTOM_FONT_STYLES_ID = "fontara-custom-font-styles"
const DYNAMIC_FONT_ID = "fontara-dynamic-font"
const GOOGLE_FONT_STYLES_ID = "fontara-google-font-styles"

export function removeInlineFontStyles(): void {
  for (const root of getDocumentAndShadowStyleRoots()) {
    root.querySelectorAll("[style*='fontara-font']").forEach((element) => {
      if (element instanceof HTMLElement) {
        element.style.fontFamily = ""
        if (element.style.length === 0) {
          element.removeAttribute("style")
        }
      }
    })
  }
}

export function injectResolvedFontStyles(
  data: FontaraFontThemeCommandData
): boolean {
  if (!data.active) {
    removeFontStyles()
    return false
  }

  upsertStyle(FONT_STYLES_ID, data.fontFaceCSS)
  updateFontVariable(data.fontName)

  if (data.googleFontCSS) {
    upsertStyle(GOOGLE_FONT_STYLES_ID, data.googleFontCSS)
  } else {
    removeStyle(GOOGLE_FONT_STYLES_ID)
  }

  if (data.customFontCSS) {
    upsertStyle(CUSTOM_FONT_STYLES_ID, data.customFontCSS)
  } else {
    removeStyle(CUSTOM_FONT_STYLES_ID)
  }

  if (data.customCSS) {
    removeEditableFontStyles()
    removeInlineFontStyles()
    upsertStyle(CUSTOM_CSS_ID, data.customCSS)
    return true
  }

  removeStyle(CUSTOM_CSS_ID)
  refreshEditableFontStyles()
  return false
}

export function removeFontStyles(): void {
  removeStyle(FONT_STYLES_ID)
  removeStyle(DYNAMIC_FONT_ID)
  removeEditableFontStyles()
  removeStyle(CUSTOM_FONT_STYLES_ID)
  removeStyle(GOOGLE_FONT_STYLES_ID)
  removeStyle(CUSTOM_CSS_ID)
  removeInlineFontStyles()
}

export function updateFontVariable(fontName: string | undefined): void {
  if (!fontName) return

  upsertStyle(
    DYNAMIC_FONT_ID,
    `
      :root {
        --fontara-font: ${formatFontFamilyForCSS(fontName)};
      }
    `
  )
}
