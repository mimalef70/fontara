const OPTIONS_PAGE_PATH = "ui/options/index.html"

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

async function openOptionsPageFallback(): Promise<void> {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(OPTIONS_PAGE_PATH)
  })
}

export async function openOptionsPageSafely(): Promise<void> {
  try {
    if (typeof chrome.runtime.openOptionsPage === "function") {
      await chrome.runtime.openOptionsPage()
      return
    }
  } catch {}

  try {
    await openOptionsPageFallback()
  } catch (error) {
    debugWarn("Failed to open FontAra options fallback page.", error)
  }
}
