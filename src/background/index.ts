import { Storage } from "@plasmohq/storage"

import {
  DEFAULT_VALUES,
  ICON_PATHS,
  STORAGE_KEYS,
  URLS
} from "~src/lib/constants"
import { isUrlActive } from "~src/lib/utils"
import { browserAPI } from "~src/utils/utils"

const storage = new Storage()

async function updateIconStatus() {
  try {
    // Get the current active tab
    const tabs = await browserAPI.tabs.query({
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

    await browserAPI.action.setIcon({ path: iconToShow })
  } catch (error) {
    await browserAPI.action.setIcon({ path: ICON_PATHS.default })
    console.error("Error updating icon status:", error)
  }
}

updateIconStatus()
storage.watch({
  isExtensionEnabled: () => updateIconStatus(),
  websiteList: () => updateIconStatus()
})
browserAPI.tabs.onActivated.addListener(updateIconStatus)
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo) => {
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
browserAPI.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === "install") {
      await ensureStorageValues()
      browserAPI.tabs.create({ url: URLS.WELCOME_PAGE })
    } else if (details.reason === "update") {
      await ensureStorageValues()
      browserAPI.tabs.create({ url: URLS.CHANGELOG })
    }
  } catch (error) {
    console.error("Error during extension installation/update:", error)
  }
})

browserAPI.runtime.setUninstallURL(
  "https://app.mu.chat/forms/cm7x2dyjo0ajl01lfci211xev"
)
