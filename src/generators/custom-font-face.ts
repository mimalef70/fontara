import type { FontData } from "../definitions"
import {
  escapeCSSString,
  getFontDataURLFormat,
  isSafeCustomFontValue
} from "../utils/font-data"

export function detectFontFormat(fontData: string): string {
  return getFontDataURLFormat(fontData) ?? "truetype"
}

export function createCustomFontFaces(
  customFontList: FontData[] | undefined
): string {
  if (!Array.isArray(customFontList) || customFontList.length === 0) {
    return ""
  }

  return customFontList
    .filter(
      (font) =>
        isSafeCustomFontValue(font.value) && getFontDataURLFormat(font.data)
    )
    .map((font) => {
      const format = getFontDataURLFormat(font.data)
      if (!format) return ""

      const fontFamily = escapeCSSString(font.value)
      const fontData = escapeCSSString(font.data)

      return `
        @font-face {
          font-family: "${fontFamily}";
          src: url("${fontData}") format("${format}");
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `
    })
    .filter(Boolean)
    .join("\n")
}
