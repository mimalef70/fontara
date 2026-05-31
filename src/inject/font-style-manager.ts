import type { FontData, WebsiteItem } from "../definitions"
import { CUSTOM_CSS_BY_SITE } from "../config/site-fixes"
import { STORAGE_KEYS } from "../config/storage"
import { getFontFaceCSS } from "../generators/font-face"
import { getLocalValue } from "../utils/storage"

const FONT_STYLES_ID = "fontara-font-styles"
const CUSTOM_CSS_ID = "fontara-custom-css-style"
const CUSTOM_FONT_STYLES_ID = "fontara-custom-font-styles"
const DYNAMIC_FONT_ID = "fontara-dynamic-font"

function getStyleHost(): HTMLElement {
  return document.head || document.documentElement
}

function upsertStyle(id: string, textContent: string): HTMLStyleElement {
  let styleElement = document.getElementById(id) as HTMLStyleElement | null

  if (!styleElement) {
    styleElement = document.createElement("style")
    styleElement.id = id
    getStyleHost().appendChild(styleElement)
  }

  if (styleElement.textContent !== textContent) {
    styleElement.textContent = textContent
  }

  return styleElement
}

function removeStyle(id: string): void {
  document.getElementById(id)?.remove()
}

function detectFontFormat(fontData: string): string {
  if (fontData.includes("data:font/woff2")) return "woff2"
  if (fontData.includes("data:font/woff")) return "woff"
  if (fontData.includes("data:font/otf")) return "opentype"
  if (fontData.includes("data:font/ttf")) return "truetype"
  return "truetype"
}

function createCustomFontFaces(customFontList: FontData[] | undefined): string {
  if (!Array.isArray(customFontList) || customFontList.length === 0) {
    return ""
  }

  return customFontList
    .filter((font) => font.value && font.data)
    .map((font) => {
      const format = detectFontFormat(font.data)
      return `
        @font-face {
          font-family: "${font.value}";
          src: url("${font.data}") format("${format}");
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `
    })
    .join("\n")
}

export async function injectFontStyles(
  matchingWebsite: WebsiteItem | null
): Promise<boolean> {
  upsertStyle(FONT_STYLES_ID, getFontFaceCSS())

  const customFontList = await getLocalValue<FontData[]>(
    STORAGE_KEYS.CUSTOM_FONT_LIST
  )
  const customFontFaces = createCustomFontFaces(customFontList)
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
    upsertStyle(CUSTOM_CSS_ID, customCSS)
    return true
  }

  removeStyle(CUSTOM_CSS_ID)
  return false
}

export function removeFontStyles(): void {
  removeStyle(FONT_STYLES_ID)
  removeStyle(DYNAMIC_FONT_ID)
  removeStyle(CUSTOM_FONT_STYLES_ID)
  removeStyle(CUSTOM_CSS_ID)

  document.querySelectorAll("[style*='fontara-font']").forEach((element) => {
    if (element instanceof HTMLElement) {
      element.style.fontFamily = ""
      if (element.style.length === 0) {
        element.removeAttribute("style")
      }
    }
  })
}

export function updateFontVariable(fontName: string | undefined): void {
  if (!fontName) return

  upsertStyle(
    DYNAMIC_FONT_ID,
    `
      :root {
        --fontara-font: "${fontName}";
      }
    `
  )
}

export async function initializeFontVariable(): Promise<void> {
  const selectedFont = await getLocalValue<string>(STORAGE_KEYS.SELECTED_FONT)
  updateFontVariable(selectedFont)
}
