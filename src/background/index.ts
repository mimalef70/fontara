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

// Updated extension state interface
interface ExtensionState {
  isEnabled: boolean
  defaultFont: {
    value: string
    name: string
    svg: string
    style: string
  }
}

// Initialize extension state with enabled by default
const DEFAULT_STATE: ExtensionState = {
  isEnabled: true,
  defaultFont: {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  }
};

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
      case "addCustomFont":
        handleAddCustomFont(message, sendResponse)
        break

      case "deleteCustomFont":
        handleDeleteCustomFont(message, sendResponse)
        break

      default:
        if (message.name === "changeFont") {
          handleFontChange(message, sendResponse)
        }
    }
  }
)

// Handle adding custom fonts
async function handleAddCustomFont(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    const customFonts = await storage.get("customFonts") || []
    const newFont = {
      name: message.fontName,
      data: message.fontData.data,
      type: message.fontData.type,
      weight: message.fontData.weight
    }

    await storage.set("customFonts", [...customFonts, newFont])
    notifyAllTabs({
      action: "addCustomFont",
      fontName: message.fontName,
      fontData: message.fontData
    })

    sendResponse({ success: true })
  } catch (error) {
    // console.error("Error adding custom font:", error)
    sendResponse({ success: false, error })
  }
}

// Handle deleting custom fonts
async function handleDeleteCustomFont(message: any, sendResponse: (response?: any) => void) {
  try {
    const customFonts: any = await storage.get("customFonts") || []
    const updatedFonts = customFonts.filter(font => font.name !== message.fontName)
    await storage.set("customFonts", updatedFonts)

    notifyAllTabs({
      action: "deleteCustomFont",
      fontName: message.fontName
    })

    sendResponse({ success: true })
  } catch (error) {
    // console.error("Error deleting custom font:", error)
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
    // console.error("Error resetting settings:", error)
    sendResponse({ success: false, error })
  }
}

// Handle font change messages
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
    // console.error("Error changing font:", error)
    sendResponse({ success: false, error })
  }
}

// Handle custom URL status updates
async function handleCustomUrlUpdate(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    await storage.set("customActiveUrls", message.data)
    notifyAllTabs({
      action: "updateCustomUrlStatus",
      data: message.data
    })
    sendResponse({ success: true })
  } catch (error) {
    // console.error("Error updating custom URLs:", error)
    sendResponse({ success: false, error })
  }
}

// Handle popular URLs updates
async function handlePopularUrlsUpdate(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    await storage.set("popularActiveUrls", message.popularActiveUrls)
    notifyAllTabs({
      action: "updatePopularActiveUrls",
      popularActiveUrls: message.popularActiveUrls
    })
    sendResponse({ success: true })
  } catch (error) {
    // console.error("Error updating popular URLs:", error)
    sendResponse({ success: false, error })
  }
}

// Modified checkIfUrlShouldBeActive to respect extension state

async function checkIfUrlShouldBeActive(url: string, tabId: number) {
  try {
    // Check extension state first
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendActiveStatus(tabId, false)

      browserAPI.tabs.sendMessage(tabId, {
        action: "toggle",
        isExtensionEnabled: false
      })
      return false
    }

    const popularActiveUrls = await storage.get<BoxItem[]>("popularActiveUrls")
    const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls")

    let isActive = false

    // Check popular URLs
    if (popularActiveUrls) {
      isActive = popularActiveUrls.some(
        (item) =>
          item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
      )
    }

    // Check custom URLs if not already active
    if (!isActive && customActiveUrls) {
      isActive = customActiveUrls.some(
        (item) =>
          item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
      )
    }

    // Send status to tab
    sendActiveStatus(tabId, isActive)
    browserAPI.tabs.sendMessage(tabId, {
      action: "toggle",
      isExtensionEnabled: extensionState.isEnabled
    })
    return isActive

  } catch (error) {
    // console.error("Error checking URL active status:", error)
    return false
  }
}

// Utility functions
function notifyAllTabs(message: any) {
  browserAPI.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
    tabs.forEach((tab) => {
      if (tab.id !== undefined) {
        browserAPI.tabs
          .sendMessage(tab.id, message)

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
}

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