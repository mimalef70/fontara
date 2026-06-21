import { getFontaraSiteActivationState } from "../config/site-manager"
import { ICON_PATHS } from "../config/storage"
import type { FontaraContentScriptMessage } from "../definitions"
import {
  isFontaraContentScriptMessage,
  MESSAGE_TYPES_CS_TO_BG
} from "../utils/message"
import { getBackgroundSettings } from "./settings-manager"

type IconPath = Parameters<typeof chrome.action.setIcon>[0]["path"]

async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  return tabs[0] ?? null
}

async function setIcon(
  path: IconPath,
  tabId?: number | null
): Promise<boolean> {
  try {
    await chrome.action.setIcon({
      path,
      ...(typeof tabId === "number" ? { tabId } : {})
    })
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
  const currentTab = await getCurrentTab()

  await updateIconStatusForUrl(
    currentTab?.url || "",
    settings,
    typeof currentTab?.id === "number" ? currentTab.id : null
  )
}

export async function updateIconStatusForUrl(
  url: string,
  settings?: Record<string, unknown>,
  tabId?: number | null
): Promise<void> {
  try {
    const active = isSupportedPageURL(url)
      ? getFontaraSiteActivationState(
          url,
          settings ?? (await getBackgroundSettings())
        ).active
      : false
    const updated = await setIcon(
      active ? ICON_PATHS.active : ICON_PATHS.default,
      tabId
    )

    if (!updated && active) {
      await setIcon(ICON_PATHS.default, tabId)
    }
  } catch (error) {
    if (__DEBUG__) {
      console.warn("Failed to resolve FontAra icon state.", error)
    }
  }
}

function shouldUpdateIconForContentMessage(
  message: unknown
): message is FontaraContentScriptMessage {
  return (
    isFontaraContentScriptMessage(message) &&
    message.data.isTopFrame &&
    (message.type === MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT ||
      message.type === MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME ||
      message.type === MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE)
  )
}

export function registerIconListeners(): void {
  void updateIconStatus()

  chrome.tabs.onActivated.addListener(() => {
    void updateIconStatus()
  })

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url) {
      void updateIconStatusForUrl(changeInfo.url, undefined, _tabId)
    }
  })

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!shouldUpdateIconForContentMessage(message)) {
      return false
    }

    void updateIconStatusForUrl(
      message.data.url,
      undefined,
      typeof sender.tab?.id === "number" ? sender.tab.id : null
    )
    return false
  })
}
