import { normalizeCustomFontUnicodeRange } from "../config/font-unicode-range"
import type { FontData } from "../definitions"
import {
  escapeCSSString,
  getFontDataURLFormat,
  isSafeCustomFontValue,
  normalizeFontDataURL
} from "../utils/font-data"

export function createCustomFontFaces(
  customFontList: FontData[] | undefined
): string {
  if (!Array.isArray(customFontList) || customFontList.length === 0) {
    return ""
  }

  return customFontList
    .filter((font) => isSafeCustomFontValue(font.value))
    .map((font) => {
      const normalizedDataURL = normalizeFontDataURL(font.data, font.type)
      const format = getFontDataURLFormat(normalizedDataURL)
      if (!normalizedDataURL || !format) return ""

      const fontFamily = escapeCSSString(font.value)
      const fontData = escapeCSSString(normalizedDataURL)
      const unicodeRange = normalizeCustomFontUnicodeRange(font.unicodeRange)
      const declarations = [
        `font-family: "${fontFamily}";`,
        `src: url("${fontData}") format("${format}");`,
        "font-weight: normal;",
        "font-style: normal;",
        "font-display: swap;",
        unicodeRange ? `unicode-range: ${unicodeRange};` : ""
      ]
        .filter(Boolean)
        .map((declaration) => `          ${declaration}`)
        .join("\n")

      return `
        @font-face {
${declarations}
        }
      `
    })
    .filter(Boolean)
    .join("\n")
}
