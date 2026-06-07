import fontFaceCSS from "../fonts.css"
import { rewriteFontFaceAssetUrls } from "./font-face-url"

let cachedFontFaceCSS: string | null = null

export function getFontFaceCSS(): string {
  cachedFontFaceCSS ??= rewriteFontFaceAssetUrls(fontFaceCSS, (path) =>
    chrome.runtime.getURL(path)
  )

  return cachedFontFaceCSS
}
