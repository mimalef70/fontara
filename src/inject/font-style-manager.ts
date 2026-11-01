import type { FontaraFontThemeCommandData } from "../definitions"
import { formatFontFamilyForCSS } from "../utils/font-data"
import {
  removeAllOwnedFontStyles,
  removeOrphanedFontaraInlineStyles
} from "./dom-processor"
import {
  refreshEditableFontStyles,
  removeEditableFontStyles
} from "./editable-font-style"
import { removeStyle, upsertStyle } from "./style-utils"

const FONT_STYLES_ID = "fontara-font-styles"
const CUSTOM_CSS_ID = "fontara-custom-css-style"
const DYNAMIC_FONT_ID = "fontara-dynamic-font"
const GOOGLE_FONT_STYLES_ID = "fontara-google-font-styles"

export function removeInlineFontStyles(
  options: { includeShadowRoots?: boolean } = {}
): void {
  removeAllOwnedFontStyles()
  removeOrphanedFontaraInlineStyles(options)
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

  // Google fonts are registered from locally cached bytes. Remove the legacy
  // URL-backed stylesheet during upgrades so pages never contact gstatic.
  removeStyle(GOOGLE_FONT_STYLES_ID)

  if (data.customCSS) {
    removeEditableFontStyles()
    // Site CSS owns light DOM, while generic traversal remains active inside
    // open Shadow DOM where document styles cannot cross the boundary.
    removeInlineFontStyles({ includeShadowRoots: false })
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
