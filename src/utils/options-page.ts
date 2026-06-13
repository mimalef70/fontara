const OPTIONS_PAGE_PATH = "ui/options/index.html"

type OptionsPageSection =
  | "advanced"
  | "fonts"
  | "general"
  | "hotkeys"
  | "rtl"
  | "sites"

type OpenOptionsPageOptions = {
  section?: OptionsPageSection
}

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

function getOptionsPagePath(options?: OpenOptionsPageOptions): string {
  return options?.section
    ? `${OPTIONS_PAGE_PATH}#${options.section}`
    : OPTIONS_PAGE_PATH
}

async function openOptionsPageFallback(
  options?: OpenOptionsPageOptions
): Promise<void> {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(getOptionsPagePath(options))
  })
}

export async function openOptionsPageSafely(
  options?: OpenOptionsPageOptions
): Promise<void> {
  try {
    if (
      !options?.section &&
      typeof chrome.runtime.openOptionsPage === "function"
    ) {
      await chrome.runtime.openOptionsPage()
      return
    }
  } catch {}

  try {
    await openOptionsPageFallback(options)
  } catch (error) {
    debugWarn("Failed to open FontAra options fallback page.", error)
  }
}
