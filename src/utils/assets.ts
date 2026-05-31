export function getExtensionAssetURL(path: string): string {
  if (
    path.startsWith("chrome-extension://") ||
    path.startsWith("moz-extension://")
  ) {
    return path
  }

  return chrome.runtime.getURL(path.replace(/^\/+/, ""))
}
