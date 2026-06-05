import fontFaceCSS from "../fonts.css"
import { rewriteFontFaceAssetUrls } from "./font-face-url"

export function getFontFaceCSS(): string {
  return rewriteFontFaceAssetUrls(fontFaceCSS, (path) =>
    chrome.runtime.getURL(path)
  )
}
