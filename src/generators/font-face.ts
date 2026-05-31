// @ts-expect-error esbuild loads text assets through the ?text suffix.
import fontFaceCSS from "../fonts.css?text"

export function getFontFaceCSS(): string {
  return fontFaceCSS.replace(
    /url\("assets\/([^"]+)"\)/g,
    (_, assetPath: string) => `url("${chrome.runtime.getURL(`assets/${assetPath}`)}")`
  )
}
