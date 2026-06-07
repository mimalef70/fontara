import { ICON_PATHS, STORAGE_KEYS } from "../config/storage"
import { watchLocalStorage } from "../utils/storage"
import { isUrlActive } from "../utils/url"

type IconPath = Parameters<typeof chrome.action.setIcon>[0]["path"]

async function getCurrentTabURL(): Promise<string> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  return tabs[0]?.url || ""
}

async function setIcon(path: IconPath): Promise<boolean> {
  try {
    await chrome.action.setIcon({ path })
    return true
  } catch (error) {
    if (__DEBUG__) {
      console.warn("Failed to update FontAra icon.", error)
    }
    return false
  }
}

export async function updateIconStatus(): Promise<void> {
  try {
    const currentUrl = await getCurrentTabURL()
    const active = await isUrlActive(currentUrl)
    const updated = await setIcon(
      active ? ICON_PATHS.active : ICON_PATHS.default
    )

    if (!updated && active) {
      await setIcon(ICON_PATHS.default)
    }
  } catch (error) {
    if (__DEBUG__) {
      console.warn("Failed to resolve FontAra icon state.", error)
    }
  }
}

export function registerIconListeners(): void {
  void updateIconStatus()

  watchLocalStorage({
    [STORAGE_KEYS.DISABLED_FOR]: updateIconStatus,
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: updateIconStatus,
    [STORAGE_KEYS.ENABLED_FOR]: updateIconStatus,
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
