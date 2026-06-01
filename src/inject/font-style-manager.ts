import { CUSTOM_CSS_BY_SITE } from "../config/site-fixes"
import { STORAGE_KEYS } from "../config/storage"
import type { FontData, WebsiteItem } from "../definitions"
import { createCustomFontFaces } from "../generators/custom-font-face"
import { getFontFaceCSS } from "../generators/font-face"
import { escapeCSSString } from "../utils/font-data"
import { getLocalValue } from "../utils/storage"

const FONT_STYLES_ID = "fontara-font-styles"
const CUSTOM_CSS_ID = "fontara-custom-css-style"
const CUSTOM_FONT_STYLES_ID = "fontara-custom-font-styles"
const DYNAMIC_FONT_ID = "fontara-dynamic-font"
const MANAGED_STYLE_IDS = new Set([
  CUSTOM_CSS_ID,
  CUSTOM_FONT_STYLES_ID,
  DYNAMIC_FONT_ID,
  FONT_STYLES_ID
])

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

export function areBaseFontStylesPresent(): boolean {
  return Boolean(
    document.getElementById(FONT_STYLES_ID) &&
      document.getElementById(DYNAMIC_FONT_ID)
  )
}

export function isManagedFontStyleElement(node: Node): boolean {
  return node instanceof HTMLElement && MANAGED_STYLE_IDS.has(node.id)
}

async function getSelectedCustomFonts(): Promise<FontData[]> {
  const [customFontList, selectedFont] = await Promise.all([
    getLocalValue<FontData[]>(STORAGE_KEYS.CUSTOM_FONT_LIST),
    getLocalValue<string>(STORAGE_KEYS.SELECTED_FONT)
  ])

  if (!Array.isArray(customFontList) || !selectedFont) {
    return []
  }

  return customFontList.filter((font) => font.value === selectedFont)
}

export async function injectFontStyles(
  matchingWebsite: WebsiteItem | null
): Promise<boolean> {
  upsertStyle(FONT_STYLES_ID, getFontFaceCSS())

  const customFontFaces = createCustomFontFaces(await getSelectedCustomFonts())
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

export async function initializeFontVariable(): Promise<void> {
  const selectedFont = await getLocalValue<string>(STORAGE_KEYS.SELECTED_FONT)
  updateFontVariable(selectedFont)
}
