import { CUSTOM_CSS_BY_SITE } from "../config/site-fixes"
import { STORAGE_KEYS } from "../config/storage"
import type {
  FontaraFontThemeCommandData,
  FontData,
  SiteProfile,
  WebsiteItem
} from "../definitions"
import { getFontFaceCSS } from "../generators/font-face"
import { resolveFontSelection } from "../generators/font-selection"
import { formatFontFamilyForCSS } from "../utils/font-data"
import { getLocalValue } from "../utils/storage"
import {
  refreshEditableFontStyles,
  removeEditableFontStyles
} from "./editable-font-style"
import { removeStyle, upsertStyle } from "./style-utils"

const FONT_STYLES_ID = "fontara-font-styles"
const CUSTOM_CSS_ID = "fontara-custom-css-style"
const CUSTOM_FONT_STYLES_ID = "fontara-custom-font-styles"
const DYNAMIC_FONT_ID = "fontara-dynamic-font"
const GOOGLE_FONT_STYLES_ID = "fontara-google-font-styles"

export function removeInlineFontStyles(): void {
  document.querySelectorAll("[style*='fontara-font']").forEach((element) => {
    if (element instanceof HTMLElement) {
      element.style.fontFamily = ""
      if (element.style.length === 0) {
        element.removeAttribute("style")
      }
    }
  })
}

export async function injectFontStyles(
  matchingWebsite: WebsiteItem | null,
  siteProfile: SiteProfile | null
): Promise<boolean> {
  upsertStyle(FONT_STYLES_ID, getFontFaceCSS())
  const selectedFont =
    siteProfile?.font ??
    (await getLocalValue<string>(STORAGE_KEYS.SELECTED_FONT))
  const selectedFontState = await resolveFontSelection(selectedFont, {
    readCustomFontList: () =>
      getLocalValue<FontData[]>(STORAGE_KEYS.CUSTOM_FONT_LIST),
    readGoogleFontsEnabled: () =>
      getLocalValue<boolean>(STORAGE_KEYS.GOOGLE_FONTS_ENABLED),
    readSystemFontsEnabled: () =>
      getLocalValue<boolean>(STORAGE_KEYS.SYSTEM_FONTS_ENABLED)
  })
  updateFontVariable(selectedFontState.fontName)

  if (selectedFontState.googleFontCSS) {
    upsertStyle(GOOGLE_FONT_STYLES_ID, selectedFontState.googleFontCSS)
  } else {
    removeStyle(GOOGLE_FONT_STYLES_ID)
  }

  if (selectedFontState.customFontCSS) {
    upsertStyle(CUSTOM_FONT_STYLES_ID, selectedFontState.customFontCSS)
  } else {
    removeStyle(CUSTOM_FONT_STYLES_ID)
  }

  const customCSS =
    matchingWebsite?.customCss && matchingWebsite.url
      ? CUSTOM_CSS_BY_SITE[matchingWebsite.url]
      : null

  if (customCSS) {
    removeEditableFontStyles()
    removeInlineFontStyles()
    upsertStyle(CUSTOM_CSS_ID, customCSS)
    return true
  }

  removeStyle(CUSTOM_CSS_ID)
  refreshEditableFontStyles()
  return false
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
