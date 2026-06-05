export function rewriteFontFaceAssetUrls(
  css: string,
  getURL: (path: string) => string
): string {
  return css.replace(
    /url\(\s*(["']?)assets\/([^"')]+)\1\s*\)/g,
    (_match, _quote: string, assetPath: string) =>
      `url("${getURL(`assets/${assetPath}`)}")`
  )
}
