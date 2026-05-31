import { ICON_PATHS, STORAGE_KEYS } from "../config/storage"
import { watchLocalStorage } from "../utils/storage"
import { isUrlActive } from "../utils/url"

async function getCurrentTabURL(): Promise<string> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  return tabs[0]?.url || ""
}

export async function updateIconStatus(): Promise<void> {
  try {
    const currentUrl = await getCurrentTabURL()
    const active = await isUrlActive(currentUrl)
    await chrome.action.setIcon({
      path: active ? ICON_PATHS.active : ICON_PATHS.default
    })
  } catch {
    await chrome.action.setIcon({ path: ICON_PATHS.default })
  }
}

export function registerIconListeners(): void {
  void updateIconStatus()

  watchLocalStorage({
    [STORAGE_KEYS.EXTENSION_ENABLED]: updateIconStatus,
    [STORAGE_KEYS.WEBSITE_LIST]: updateIconStatus
  })

  chrome.tabs.onActivated.addListener(() => {
    void updateIconStatus()
  })

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url) {
      void updateIconStatus()
    }
  })
}
