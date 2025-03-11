import { Storage } from "@plasmohq/storage"

import {
  DEFAULT_VALUES,
  ICON_PATHS,
  STORAGE_KEYS,
  URLS
} from "~src/lib/constants"
import { isUrlActive } from "~src/lib/utils"

const storage = new Storage({ area: "local" })

async function updateIconStatus() {
  console.log("updateIconStatus")
  try {
    // Get the current active tab
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })
    const currentTab = tabs[0]
    const currentUrl = currentTab?.url || ""

    const isActive = await isUrlActive(currentUrl)

    let iconToShow
    if (isActive) {
      iconToShow = ICON_PATHS.active
    } else {
      iconToShow = ICON_PATHS.default
    }

    await chrome.action.setIcon({ path: iconToShow })
  } catch (error) {
    await chrome.action.setIcon({ path: ICON_PATHS.default })
    console.error("Error updating icon status:", error)
  }
}

updateIconStatus()
storage.watch({
  isExtensionEnabled: () => updateIconStatus(),
  websiteList: () => updateIconStatus()
})
chrome.tabs.onActivated.addListener(updateIconStatus)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    updateIconStatus()
  }
})

async function ensureStorageValues(keysToCheck = Object.keys(STORAGE_KEYS)) {
  const storageUpdates = {}

  for (const key of keysToCheck) {
    const value = await storage.get(STORAGE_KEYS[key])
    if (value === undefined) {
      storageUpdates[STORAGE_KEYS[key]] = DEFAULT_VALUES[key] || null
    }
  }

  if (Object.keys(storageUpdates).length > 0) {
    await Promise.all(
      Object.entries(storageUpdates).map(([key, value]) =>
        storage.set(key, value)
      )
    )
  }

  return storageUpdates
}

// Event Listeners in first install
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === "install") {
      await ensureStorageValues()
      chrome.tabs.create({ url: URLS.WELCOME_PAGE })
    } else if (details.reason === "update") {
      await ensureStorageValues()
      chrome.tabs.create({ url: URLS.CHANGELOG })
    }
  } catch (error) {
    console.error("Error during extension installation/update:", error)
  }
})

chrome.runtime.setUninstallURL(
  "https://app.mu.chat/forms/cm7x2dyjo0ajl01lfci211xev"
)
