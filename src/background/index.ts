import { Storage } from "@plasmohq/storage"

import { initialBoxes } from "~data/popularUrlData"
import { STORAGE_KEYS } from "~src/lib/constants"
import { ICON_PATHS } from "~src/utils/constants"
import type { BoxItem } from "~src/utils/types"
import { browserAPI, urlPatternToRegex } from "~src/utils/utils"

const storage = new Storage()

async function getStorageData() {
  const [isExtensionEnabled, popularActiveUrls, customActiveUrls] =
    await Promise.all([
      storage.get<boolean>(STORAGE_KEYS.EXTENSION_ENABLED),
      storage.get<BoxItem[]>("popularActiveUrls") || [],
      storage.get<BoxItem[]>("customActiveUrls") || []
    ])
  return { isExtensionEnabled, popularActiveUrls, customActiveUrls }
}

async function updateExtensionIcon() {
  try {
    const { isExtensionEnabled, popularActiveUrls, customActiveUrls } =
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
          (isCustomMatch || isPopularMatch) && isExtensionEnabled
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
    const { isExtensionEnabled, popularActiveUrls, customActiveUrls } =
      await getStorageData()

    if (!isExtensionEnabled) {
      await Promise.all([
        browserAPI.tabs.sendMessage(tabId, {
          action: "setActiveStatus",
          isActive: false
        }),
        browserAPI.tabs.sendMessage(tabId, {
          action: "toggle",
          isExtensionEnabled: false
        })
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
      browserAPI.tabs.sendMessage(tabId, {
        action: "setActiveStatus",
        isActive
      }),
      browserAPI.tabs.sendMessage(tabId, {
        action: "toggle",
        isExtensionEnabled: isExtensionEnabled
      })
    ])

    return isActive
  } catch (error) {
    return false
  }
}

// Event Listeners in first install
browserAPI.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await Promise.all([
      storage.set(STORAGE_KEYS.EXTENSION_ENABLED, true),
      storage.set("popularActiveUrls", initialBoxes),
      storage.set("customActiveUrls", []),
      storage.set("selectedFont", "Vazirmatn")
    ])
    const tabs = await browserAPI.tabs.query({})
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id) {
          try {
            await browserAPI.tabs.sendMessage(tab.id, {
              action: "updatePopularActiveUrls",
              popularActiveUrls: initialBoxes
            })

            await browserAPI.tabs.reload(tab.id)
          } catch (error) {}
        }
      })
    )

    const activeUrls = await storage.get("activeUrls")
    if (!activeUrls) {
      await storage.set(
        "activeUrls",
        initialBoxes.map((item) => ({
          url: item.url,
          regex: item.url
        }))
      )
    }

    chrome.tabs.create({
      url: "https://mimalef70.github.io/fontara"
    })
  }

  if (details.reason === "update") {
    // Check for missing storage fields and add them if needed
    try {
      const isExtensionEnabled = await storage.get(
        STORAGE_KEYS.EXTENSION_ENABLED
      )
      if (!isExtensionEnabled) {
        await storage.set(STORAGE_KEYS.EXTENSION_ENABLED, true)
      }

      const popularActiveUrls = await storage.get("popularActiveUrls")
      if (!popularActiveUrls) {
        await storage.set("popularActiveUrls", initialBoxes)
      }

      const customActiveUrls = await storage.get("customActiveUrls")
      if (!customActiveUrls) {
        await storage.set("customActiveUrls", [])
      }

      const selectedFont = await storage.get("selectedFont")
      if (!selectedFont) {
        await storage.set("selectedFont", "Vazirmatn")
      }

      const activeUrls = await storage.get("activeUrls")
      if (!activeUrls) {
        await storage.set(
          "activeUrls",
          initialBoxes.map((item) => ({
            url: item.url,
            regex: item.url
          }))
        )
      }

      // Open the changelog page
      // chrome.tabs.create({
      //   url: "https://mimalef70.github.io/fontara#changelogs"
      // })
    } catch (error) {
      console.error("Error during extension update:", error)
    }
  }

  await updateExtensionIcon()
})

browserAPI.runtime.setUninstallURL(
  "https://app.mu.chat/forms/cm7x2dyjo0ajl01lfci211xev"
)

// Combined storage change listener
browserAPI.storage.onChanged.addListener(async (changes) => {
  if (
    changes.customActiveUrls ||
    changes.popularActiveUrls ||
    changes.isExtensionEnabled
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

function sendToAllTabs(message) {
  chrome.tabs.query({}, function (tabs) {
    for (let i = 0; i < tabs.length; i++) {
      chrome.tabs.sendMessage(tabs[i].id, message)
    }
  })
}
