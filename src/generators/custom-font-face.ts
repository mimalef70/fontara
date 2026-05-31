import type { FontData } from "../definitions"

export function detectFontFormat(fontData: string): string {
  if (fontData.includes("data:font/woff2")) return "woff2"
  if (fontData.includes("data:font/woff")) return "woff"
  if (fontData.includes("data:font/otf")) return "opentype"
  if (fontData.includes("data:font/ttf")) return "truetype"
  return "truetype"
}

export function createCustomFontFaces(
  customFontList: FontData[] | undefined
): string {
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
