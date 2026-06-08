import { getFontaraSiteActivationState } from "../config/site-manager"
import { ICON_PATHS } from "../config/storage"
import { getBackgroundSettings } from "./settings-manager"

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

function isSupportedPageURL(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

export async function updateIconStatus(
  settings?: Record<string, unknown>
): Promise<void> {
  try {
    const currentUrl = await getCurrentTabURL()
    const active = isSupportedPageURL(currentUrl)
      ? getFontaraSiteActivationState(
          currentUrl,
          settings ?? (await getBackgroundSettings())
        ).active
      : false
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

  chrome.tabs.onActivated.addListener(() => {
    void updateIconStatus()
  })

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url) {
      void updateIconStatus()
    }
  })
}
