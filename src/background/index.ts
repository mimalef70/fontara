import { Storage } from "@plasmohq/storage"

const storage = new Storage()

declare const chrome: any
declare const browser: any

const browserAPI: typeof chrome =
  typeof browser !== "undefined" ? browser : chrome

interface BoxItem {
  id?: string
  src?: string
  isActive: boolean
  url: string
}

// Add extension state interface
interface ExtensionState {
  isEnabled: boolean
  defaultFont: {
    value: string
    name: string
    svg: string
    style: string
  }
}

// Initialize extension state
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

// Unified message listener for all actions
browserAPI.runtime.onMessage.addListener(
  (message: any, sender: any, sendResponse: (response?: any) => void) => {
    switch (message.action) {
      case "changeFont":
        handleFontChange(message, sendResponse)
        break
      case "updateCustomUrlStatus":
        handleCustomUrlUpdate(message, sendResponse)
        break
      case "updatePopularActiveUrls":
        handlePopularUrlsUpdate(message, sendResponse)
        break
      case "resetFontSettings":
        handleResetSettings(message, sendResponse)
        break
      case "toggleExtension":
        handleExtensionToggle(message, sendResponse)
        break
      default:
        if (message.name === "changeFont") {
          handleFontChange(message, sendResponse)
        }
    }
  }
)

// Handle extension toggle
async function handleExtensionToggle(message: any, sendResponse: (response?: any) => void) {
  try {
    const { isEnabled } = message.data
    const currentState = await storage.get<ExtensionState>("extensionState")
    const newState = { ...currentState, isEnabled }

    await storage.set("extensionState", newState)

    if (!isEnabled) {
      // Reset all settings when extension is disabled
      await handleResetSettings({ data: { font: DEFAULT_STATE.defaultFont } }, sendResponse)
    }

    notifyAllTabs({
      action: "extensionStateChanged",
      state: newState
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error("Error toggling extension:", error)
    sendResponse({ success: false, error })
  }
}

// Handle reset settings
async function handleResetSettings(message: any, sendResponse: (response?: any) => void) {
  try {
    // Reset font
    await storage.set("selectedFont", DEFAULT_STATE.defaultFont)

    // Reset custom URLs
    await storage.set("customActiveUrls", [])

    // Reset popular URLs to default state (all active)
    const popularUrls = await storage.get<BoxItem[]>("popularActiveUrls")
    if (popularUrls) {
      const resetPopularUrls = popularUrls.map(url => ({ ...url, isActive: true }))
      await storage.set("popularActiveUrls", resetPopularUrls)
    }

    notifyAllTabs({
      action: "settingsReset",
      defaultFont: DEFAULT_STATE.defaultFont
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error("Error resetting settings:", error)
    sendResponse({ success: false, error })
  }
}

// Handle font change messages (modified)
async function handleFontChange(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    const fontName = message.body?.fontName || message.font
    await storage.set("selectedFont", fontName)
    notifyAllTabs({
      action: "updateFont",
      fontName
    })
    sendResponse({ success: true })
  } catch (error) {
    console.error("Error changing font:", error)
    sendResponse({ success: false, error })
  }
}

// Handle custom URL status updates (modified)
async function handleCustomUrlUpdate(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    console.log("Updating custom URL status:", message.data)
    await storage.set("customActiveUrls", message.data)
    notifyAllTabs({
      action: "updateCustomUrlStatus",
      data: message.data
    })
    sendResponse({ success: true })
  } catch (error) {
    console.error("Error updating custom URLs:", error)
    sendResponse({ success: false, error })
  }
}

// Handle popular URLs updates (modified)
async function handlePopularUrlsUpdate(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    console.log("Updating popular URLs:", message.popularActiveUrls)
    await storage.set("popularActiveUrls", message.popularActiveUrls)
    notifyAllTabs({
      action: "updatePopularActiveUrls",
      popularActiveUrls: message.popularActiveUrls
    })
    sendResponse({ success: true })
  } catch (error) {
    console.error("Error updating popular URLs:", error)
    sendResponse({ success: false, error })
  }
}

// Modified checkIfUrlShouldBeActive to respect extension state
async function checkIfUrlShouldBeActive(url: string, tabId: number) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendActiveStatus(tabId, false)
      return false
    }

    // Rest of your existing checkIfUrlShouldBeActive logic...
    const popularActiveUrls = await storage.get<BoxItem[]>("popularActiveUrls")
    if (popularActiveUrls) {
      const isPopularActive = popularActiveUrls.some(
        (item) =>
          item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
      )

      if (isPopularActive) {
        sendActiveStatus(tabId, true)
        return true
      }
    }

    const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls")
    if (customActiveUrls) {
      const isCustomActive = customActiveUrls.some(
        (item) =>
          item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
      )

      sendActiveStatus(tabId, isCustomActive)
      return isCustomActive
    }

    sendActiveStatus(tabId, false)
    return false
  } catch (error) {
    console.error("Error checking URL active status:", error)
    return false
  }
}

// Utility functions remain the same
function notifyAllTabs(message: any) {
  browserAPI.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
    tabs.forEach((tab) => {
      if (tab.id !== undefined) {
        browserAPI.tabs
          .sendMessage(tab.id, message)
          .catch((error: Error) =>
            console.log("Error sending message (tab may not be ready):", error)
          )
      }
    })
  })
}

function sendActiveStatus(tabId: number, isActive: boolean) {
  browserAPI.tabs
    .sendMessage(tabId, {
      action: "setActiveStatus",
      isActive: isActive
    })
    .catch((error: Error) => console.log("Error sending message (tab may not be ready):", error))
}

// Keep existing tabs listener
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