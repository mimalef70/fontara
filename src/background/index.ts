import { Storage } from "@plasmohq/storage"

import { initialBoxes } from "~data/popularUrlData"
import { browserAPI, urlPatternToRegex } from "~src/utils/utils"

import { DEFAULT_STATE, ICON_PATHS } from "./constants/constant"
import type { BoxItem, ExtensionState } from "./types/type"

const storage = new Storage()

async function getStorageData() {
  const [extensionState, popularActiveUrls, customActiveUrls] =
    await Promise.all([
      storage.get<ExtensionState>("extensionState") || DEFAULT_STATE,
      storage.get<BoxItem[]>("popularActiveUrls") || [],
      storage.get<BoxItem[]>("customActiveUrls") || []
    ])
  return { extensionState, popularActiveUrls, customActiveUrls }
}

async function sendTabMessage(tabId: number, message: any) {
  try {
    await browserAPI.tabs.sendMessage(tabId, message)
  } catch (error) {}
}

async function updateExtensionIcon() {
  try {
    const { extensionState, popularActiveUrls, customActiveUrls } =
      await getStorageData()

    chrome.windows.getCurrent((w) => {
      chrome.tabs.query({ active: true, windowId: w.id }, (tabs) => {
        if (!tabs[0]?.url) return

        const url = tabs[0].url
        const isCustomMatch = customActiveUrls.some(
          (item) => item.isActive && urlPatternToRegex(item.url).test(url)
        )
        const isPopularMatch = popularActiveUrls.some(
          (item) => item.isActive && urlPatternToRegex(item.url).test(url)
        )

        const iconToShow =
          (isCustomMatch || isPopularMatch) && extensionState.isEnabled
            ? ICON_PATHS.active
            : ICON_PATHS.default

        browserAPI.action.setIcon(iconToShow).catch(() => {})
      })
    })
  } catch (error) {
    browserAPI.action.setIcon(ICON_PATHS.default)
  }
}

async function checkIfUrlShouldBeActive(url: string, tabId: number) {
  try {
    const { extensionState, popularActiveUrls, customActiveUrls } =
      await getStorageData()

    if (!extensionState.isEnabled) {
      await Promise.all([
        sendTabMessage(tabId, { action: "setActiveStatus", isActive: false }),
        sendTabMessage(tabId, { action: "toggle", isExtensionEnabled: false })
      ])
      return false
    }

    const isActive = [
      ...(popularActiveUrls || []),
      ...(customActiveUrls || [])
    ].some(
      (item) =>
        item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
    )

    await Promise.all([
      sendTabMessage(tabId, { action: "setActiveStatus", isActive }),
      sendTabMessage(tabId, {
        action: "toggle",
        isExtensionEnabled: extensionState.isEnabled
      })
    ])

    return isActive
  } catch (error) {
    return false
  }
}

async function initializeExtension() {
  await storage.set("extensionState", DEFAULT_STATE)
  await updateExtensionIcon()
}

// Event Listeners in first install
browserAPI.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await Promise.all([
      storage.set("extensionState", DEFAULT_STATE),
      storage.set("popularActiveUrls", initialBoxes),
      storage.set("customActiveUrls", []),
      storage.set("selectedFont", DEFAULT_STATE.defaultFont.value)
    ])

    const tabs = await browserAPI.tabs.query({})
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id) {
          try {
            await sendTabMessage(tab.id, {
              action: "updatePopularActiveUrls",
              popularActiveUrls: initialBoxes
            })
            await browserAPI.tabs.reload(tab.id)
          } catch (error) {}
        }
      })
    )
  }
  await updateExtensionIcon()
})

// Combined storage change listener
browserAPI.storage.onChanged.addListener(async (changes) => {
  if (
    changes.customActiveUrls ||
    changes.popularActiveUrls ||
    changes.extensionState
  ) {
    await updateExtensionIcon()
  }
})

// Tab listeners
const tabEvents = ["onActivated", "onUpdated"]
tabEvents.forEach((event) => {
  browserAPI.tabs[event].addListener(async (...args) => {
    if (event === "onUpdated") {
      const [tabId, changeInfo, tab] = args
      if (changeInfo.status === "complete" && tab.url) {
        await checkIfUrlShouldBeActive(tab.url, tabId)
      }
      if (changeInfo.url) {
        await updateExtensionIcon()
      }
    } else {
      await updateExtensionIcon()
    }
  })
})

//? Lifecycle events
browserAPI.runtime.onStartup.addListener(updateExtensionIcon)

// Utility functions with error handling
export async function notifyAllTabs(message: any) {
  const tabs = await browserAPI.tabs.query({})
  const messagePromises = tabs.map(async (tab) => {
    if (tab.id !== undefined) {
      try {
        await browserAPI.tabs.sendMessage(tab.id, message)
      } catch (error) {
        // Ignore "receiving end does not exist" errors
      }
    }
  })
  await Promise.all(messagePromises)
}
