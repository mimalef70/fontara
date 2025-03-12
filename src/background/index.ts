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

  const extensionEnabled = await storage.get(STORAGE_KEYS.EXTENSION_ENABLED)
  if (extensionEnabled === undefined) {
    storageUpdates[STORAGE_KEYS.EXTENSION_ENABLED] =
      DEFAULT_VALUES.EXTENSION_ENABLED
  }

  const selectedFont = await storage.get(STORAGE_KEYS.SELECTED_FONT)
  if (selectedFont === undefined) {
    storageUpdates[STORAGE_KEYS.SELECTED_FONT] = DEFAULT_VALUES.SELECTED_FONT
  }

  const websiteList = await storage.get(STORAGE_KEYS.WEBSITE_LIST)
  if (websiteList === undefined) {
    storageUpdates[STORAGE_KEYS.WEBSITE_LIST] = DEFAULT_VALUES.WEBSITE_LIST
  } else {
    // Merge existing websites with default websites
    const updatedWebsiteList = mergeWebsiteLists(
      websiteList,
      DEFAULT_VALUES.WEBSITE_LIST
    )
    storageUpdates[STORAGE_KEYS.WEBSITE_LIST] = updatedWebsiteList
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

function mergeWebsiteLists(existingList, defaultList) {
  const mergedList = [...existingList]

  for (const defaultSite of defaultList) {
    const existingIndex = mergedList.findIndex(
      (site) => site.url === defaultSite.url
    )

    if (existingIndex === -1) {
      // Add new site if it doesn't exist
      mergedList.push(defaultSite)
    } else if ("version" in defaultSite) {
      const existingSite = mergedList[existingIndex]

      // Update site if version is different/missing, but preserve isActive state
      if (
        !("version" in existingSite) ||
        existingSite.version !== defaultSite.version
      ) {
        mergedList[existingIndex] = {
          ...defaultSite,
          isActive: existingSite.isActive
        }
      }
    }
  }

  return mergedList
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
