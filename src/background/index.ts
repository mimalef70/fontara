import { Storage } from "@plasmohq/storage"

import { initialBoxes } from "~data/popularUrlData"
import { urlPatternToRegex } from "~src/utils/pattern"

import { type BoxItem } from "./messages/resetFontSettings"

const storage = new Storage()

declare const chrome: any
declare const browser: any

const browserAPI: typeof chrome =
  typeof browser !== "undefined" ? browser : chrome

interface ExtensionState {
  isEnabled: boolean
  defaultFont: {
    value: string
    name: string
    svg: string
    style: string
  }
}

const DEFAULT_STATE: ExtensionState = {
  isEnabled: true,
  defaultFont: {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  }
}

// Store initial state
storage.set("extensionState", DEFAULT_STATE)

browserAPI.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === "install") {
      // Set initial state
      await Promise.all([
        storage.set("extensionState", DEFAULT_STATE),
        storage.set("popularActiveUrls", initialBoxes),
        storage.set("customActiveUrls", []),
        storage.set("selectedFont", DEFAULT_STATE.defaultFont.value)
      ])

      // Notify all tabs about the popularActiveUrls
      const tabs = await browserAPI.tabs.query({})
      for (const tab of tabs) {
        if (tab.id) {
          try {
            // Send the popularActiveUrls to each tab
            await browserAPI.tabs.sendMessage(tab.id, {
              action: "updatePopularActiveUrls",
              popularActiveUrls: initialBoxes
            })
            // Reload the tab to apply changes
            await browserAPI.tabs.reload(tab.id)
          } catch (error) {
            // Ignore "receiving end does not exist" errors
          }
        }
      }
    }

    await updateExtensionIcon()
  } catch (error) {}
})

async function checkIfUrlShouldBeActive(url: string, tabId: number) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      await Promise.all([
        sendActiveStatus(tabId, false),
        sendToggleStatus(tabId, false)
      ])
      return false
    }

    const popularActiveUrls = await storage.get<BoxItem[]>("popularActiveUrls")
    const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls")

    let isActive = false

    if (popularActiveUrls) {
      isActive = popularActiveUrls.some(
        (item) =>
          item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
      )
    }

    if (!isActive && customActiveUrls) {
      isActive = customActiveUrls.some(
        (item) =>
          item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
      )
    }

    await Promise.all([
      sendActiveStatus(tabId, isActive),
      sendToggleStatus(tabId, extensionState.isEnabled)
    ])

    return isActive
  } catch (error) {
    return false
  }
}

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

async function sendActiveStatus(tabId: number, isActive: boolean) {
  try {
    await browserAPI.tabs.sendMessage(tabId, {
      action: "setActiveStatus",
      isActive: isActive
    })
  } catch (error) {}
}

async function sendToggleStatus(tabId: number, isEnabled: boolean) {
  try {
    await browserAPI.tabs.sendMessage(tabId, {
      action: "toggle",
      isExtensionEnabled: isEnabled
    })
  } catch (error) {}
}

// -----------------------------------------------------------------------------
async function updateExtensionIcon() {
  try {
    const extensionState =
      (await storage.get<ExtensionState>("extensionState")) || DEFAULT_STATE
    const popularActiveUrls =
      (await storage.get<BoxItem[]>("popularActiveUrls")) || []
    const customActiveUrls =
      (await storage.get<BoxItem[]>("customActiveUrls")) || []

    chrome.windows.getCurrent((w) => {
      chrome.tabs.query({ active: true, windowId: w.id }, (tabs) => {
        if (!tabs[0]?.url) return

        const defaultIcon = {
          path: {
            "16": "../../assets/icon-16.png",
            "32": "../../assets/icon-32.png",
            "48": "../../assets/icon-48.png"
          }
        }

        const activeIcon = {
          path: {
            "16": "../../assets/icon-active-16.png",
            "32": "../../assets/icon-active-32.png",
            "48": "../../assets/icon-active-48.png"
          }
        }

        // Default to the default icon
        let iconToShow = defaultIcon

        // Handle customActiveUrls completely independently
        const matchingCustomUrl =
          Array.isArray(customActiveUrls) && customActiveUrls.length > 0
            ? customActiveUrls.find((item) =>
                urlPatternToRegex(item.url).test(tabs[0].url)
              )
            : null

        // Handle popularActiveUrls based on extension state
        const matchingPopularUrl =
          Array.isArray(popularActiveUrls) &&
          popularActiveUrls.length > 0 &&
          extensionState?.isEnabled
            ? popularActiveUrls.find((item) =>
                urlPatternToRegex(item.url).test(tabs[0].url)
              )
            : null

        // Set icon based on matches - customActiveUrls take precedence
        if (
          (matchingCustomUrl?.isActive && extensionState?.isEnabled) ||
          (matchingPopularUrl?.isActive && extensionState?.isEnabled)
        ) {
          iconToShow = activeIcon
        }

        browserAPI.action.setIcon(iconToShow).catch((error) => {})
      })
    })
  } catch (error) {
    // Set default icon in case of error
    browserAPI.action.setIcon({
      path: {
        "16": "../../assets/icon-16.png",
        "32": "../../assets/icon-32.png",
        "48": "../../assets/icon-48.png"
      }
    })
  }
}

// Update the storage listener to handle changes separately
browserAPI.storage.onChanged.addListener(async (changes, namespace) => {
  if (changes.customActiveUrls || changes.popularActiveUrls) {
    await updateExtensionIcon()
  } else if (changes.extensionState || changes.popularActiveUrls) {
    await updateExtensionIcon()
  }
})

// Initialize storage with default values if not already set
browserAPI.runtime.onInstalled.addListener(async () => {
  try {
    // Initialize extension state if not exists
    const existingState = await storage.get<ExtensionState>("extensionState")
    if (!existingState) {
      await storage.set("extensionState", DEFAULT_STATE)
    }

    // Initialize popularActiveUrls if not exists
    const existingUrls = await storage.get<BoxItem[]>("popularActiveUrls")
    if (!existingUrls) {
      await storage.set("popularActiveUrls", [])
    }

    await updateExtensionIcon()
  } catch (error) {}
})

// Listen for storage changes
browserAPI.storage.onChanged.addListener(async (changes, namespace) => {
  // If either extensionState or popularActiveUrls changes, update the icon
  if (changes.extensionState || changes.popularActiveUrls) {
    await updateExtensionIcon()
  }
})

// Listen for tab updates to check URL changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateExtensionIcon()
})

// Listen for tab URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    await updateExtensionIcon()
  }
})

// Check conditions when extension loads
chrome.runtime.onStartup.addListener(async () => {
  await updateExtensionIcon()
})

// Check conditions when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  await updateExtensionIcon()
})

// -----------------------------------------------------------------------------

// Tab update listener
browserAPI.tabs.onUpdated.addListener(
  (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ) => {
    if (changeInfo.status === "complete" && tab.url) {
      checkIfUrlShouldBeActive(tab.url, tabId)
    }
  }
)
