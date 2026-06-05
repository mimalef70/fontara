import { DEFAULT_FONTS } from "../config/fonts"
import { CUSTOM_CSS_BY_SITE } from "../config/site-fixes"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { FontData, WebsiteItem } from "../definitions"
import { createCustomFontFaces } from "../generators/custom-font-face"
import { getFontFaceCSS } from "../generators/font-face"
import { escapeCSSString } from "../utils/font-data"
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
const BUNDLED_FONT_VALUES = new Set(DEFAULT_FONTS.map((font) => font.value))

type SelectedFontState = {
  customFonts: FontData[]
  fontName: string
}

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

async function getSelectedCustomFonts(
  selectedFont: string | undefined
): Promise<FontData[]> {
  if (!selectedFont || BUNDLED_FONT_VALUES.has(selectedFont)) {
    return []
  }

  const customFontList = await getLocalValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST
  )

  if (!Array.isArray(customFontList)) return []

  return customFontList.filter((font) => font.value === selectedFont)
}

async function getSelectedFontState(
  selectedFont: string | undefined
): Promise<SelectedFontState> {
  if (!selectedFont) {
    return {
      customFonts: [],
      fontName: DEFAULT_VALUES.SELECTED_FONT
    }
  }

  if (BUNDLED_FONT_VALUES.has(selectedFont)) {
    return {
      customFonts: [],
      fontName: selectedFont
    }
  }

  const customFonts = await getSelectedCustomFonts(selectedFont)
  if (customFonts.length === 0) {
    return {
      customFonts: [],
      fontName: DEFAULT_VALUES.SELECTED_FONT
    }
  }

  return {
    customFonts,
    fontName: selectedFont
  }
}

export async function injectFontStyles(
  matchingWebsite: WebsiteItem | null
): Promise<boolean> {
  upsertStyle(FONT_STYLES_ID, getFontFaceCSS())
  const selectedFont = await getLocalValue<string>(STORAGE_KEYS.SELECTED_FONT)
  const selectedFontState = await getSelectedFontState(selectedFont)
  updateFontVariable(selectedFontState.fontName)

  const customFontFaces = createCustomFontFaces(selectedFontState.customFonts)
  if (customFontFaces) {
    upsertStyle(CUSTOM_FONT_STYLES_ID, customFontFaces)
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

export function removeFontStyles(): void {
  removeStyle(FONT_STYLES_ID)
  removeStyle(DYNAMIC_FONT_ID)
  removeEditableFontStyles()
  removeStyle(CUSTOM_FONT_STYLES_ID)
  removeStyle(CUSTOM_CSS_ID)
  removeInlineFontStyles()
}

export function updateFontVariable(fontName: string | undefined): void {
  if (!fontName) return
  const safeFontName = escapeCSSString(fontName)

  upsertStyle(
    DYNAMIC_FONT_ID,
    `
      :root {
        --fontara-font: "${safeFontName}";
      }
    `
  )
}
