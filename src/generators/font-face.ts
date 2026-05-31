import fontFaceCSS from "../fonts.css"

export function getFontFaceCSS(): string {
  return fontFaceCSS.replace(
    /url\("assets\/([^"]+)"\)/g,
    (_, assetPath: string) =>
      `url("${chrome.runtime.getURL(`assets/${assetPath}`)}")`
  )
}
