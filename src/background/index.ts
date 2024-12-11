import { Storage } from "@plasmohq/storage"
import { urlPatternToRegex } from "~src/utils/pattern"

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
    return true // Will respond asynchronously
  }
)

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
    await notifyAllTabs({
      action: "addCustomFont",
      fontName: message.fontName,
      fontData: message.fontData
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error("Error adding custom font:", error)
    sendResponse({ success: false, error })
  }
}

async function handleDeleteCustomFont(message: any, sendResponse: (response?: any) => void) {
  try {
    const customFonts: any = await storage.get("customFonts") || []
    const updatedFonts = customFonts.filter(font => font.name !== message.fontName)
    await storage.set("customFonts", updatedFonts)

    await notifyAllTabs({
      action: "deleteCustomFont",
      fontName: message.fontName
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error("Error deleting custom font:", error)
    sendResponse({ success: false, error })
  }
}

async function handleResetSettings(message: any, sendResponse: (response?: any) => void) {
  try {
    await storage.set("selectedFont", DEFAULT_STATE.defaultFont)
    await storage.set("customActiveUrls", [])

    const popularUrls = await storage.get<BoxItem[]>("popularActiveUrls")
    if (popularUrls) {
      const resetPopularUrls = popularUrls.map(url => ({ ...url, isActive: true }))
      await storage.set("popularActiveUrls", resetPopularUrls)
    }

    await notifyAllTabs({
      action: "settingsReset",
      defaultFont: DEFAULT_STATE.defaultFont
    })

    sendResponse({ success: true })
  } catch (error) {
    console.error("Error resetting settings:", error)
    sendResponse({ success: false, error })
  }
}

async function handleFontChange(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    const fontName = message.body?.fontName || message.font
    await storage.set("selectedFont", fontName)
    await notifyAllTabs({
      action: "updateFont",
      fontName
    })
    sendResponse({ success: true })
  } catch (error) {
    console.error("Error changing font:", error)
    sendResponse({ success: false, error })
  }
}

async function handleCustomUrlUpdate(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    await storage.set("customActiveUrls", message.data)
    await notifyAllTabs({
      action: "updateCustomUrlStatus",
      data: message.data
    })
    sendResponse({ success: true })
  } catch (error) {
    console.error("Error updating custom URLs:", error)
    sendResponse({ success: false, error })
  }
}

async function handlePopularUrlsUpdate(message: any, sendResponse: (response?: any) => void) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    await storage.set("popularActiveUrls", message.popularActiveUrls)
    await notifyAllTabs({
      action: "updatePopularActiveUrls",
      popularActiveUrls: message.popularActiveUrls
    })
    sendResponse({ success: true })
  } catch (error) {
    console.error("Error updating popular URLs:", error)
    sendResponse({ success: false, error })
  }
}

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
    console.error("Error checking URL active status:", error)
    return false
  }
}

// Utility functions with error handling
async function notifyAllTabs(message: any) {
  const tabs = await browserAPI.tabs.query({})
  const messagePromises = tabs.map(async (tab) => {
    if (tab.id !== undefined) {
      try {
        await browserAPI.tabs.sendMessage(tab.id, message)
      } catch (error) {
        // Ignore "receiving end does not exist" errors
        if (!error.message.includes("Receiving end does not exist")) {
          console.error(`Error sending message to tab ${tab.id}:`, error)
        }
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
  } catch (error) {
    if (!error.message.includes("Receiving end does not exist")) {
      console.error(`Error sending active status to tab ${tabId}:`, error)
    }
  }
}

async function sendToggleStatus(tabId: number, isEnabled: boolean) {
  try {
    await browserAPI.tabs.sendMessage(tabId, {
      action: "toggle",
      isExtensionEnabled: isEnabled
    })
  } catch (error) {
    if (!error.message.includes("Receiving end does not exist")) {
      console.error(`Error sending toggle status to tab ${tabId}:`, error)
    }
  }
}

// -----------------------------------------------------------------------------
const extensionStateIcon = async () => {

}

const popularActiveUrlsIcon = async () => {

}

// -----------------------------------------------------------------------------
async function updateExtensionIcon() {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState") || DEFAULT_STATE;
    const popularActiveUrls = await storage.get<BoxItem[]>("popularActiveUrls") || [];

    chrome.windows.getCurrent(w => {
      chrome.tabs.query({ active: true, windowId: w.id }, tabs => {
        if (!tabs[0]?.url) return;

        const defaultIcon = {
          path: {
            "16": "../../assets/icon-16.png",
            "32": "../../assets/icon-32.png",
            "48": "../../assets/icon-48.png"
          }
        };

        const activeIcon = {
          path: {
            "16": "../../assets/icon-active-16.png",
            "32": "../../assets/icon-active-32.png",
            "48": "../../assets/icon-active-48.png"
          }
        };

        // Default to the default icon
        let iconToShow = defaultIcon;

        // Only try to find matching URL if popularActiveUrls exists and has items
        if (Array.isArray(popularActiveUrls) && popularActiveUrls.length > 0) {
          const matchingUrl = popularActiveUrls.find((item) =>
            urlPatternToRegex(item.url).test(tabs[0].url)
          );

          // Update icon only if extension is enabled and we have a matching active URL
          if (extensionState?.isEnabled && matchingUrl?.isActive) {
            iconToShow = activeIcon;
          }
        }

        browserAPI.action.setIcon(iconToShow).catch(error => {
          console.error('Error setting extension icon:', error);
        });
      });
    });
  } catch (error) {
    console.error('Error in updateExtensionIcon:', error);
    // Set default icon in case of error
    browserAPI.action.setIcon({
      path: {
        "16": "../../assets/icon-16.png",
        "32": "../../assets/icon-32.png",
        "48": "../../assets/icon-48.png"
      }
    }).catch(console.error);
  }
}

// Initialize storage with default values if not already set
browserAPI.runtime.onInstalled.addListener(async () => {
  try {
    // Initialize extension state if not exists
    const existingState = await storage.get<ExtensionState>("extensionState");
    if (!existingState) {
      await storage.set("extensionState", DEFAULT_STATE);
    }

    // Initialize popularActiveUrls if not exists
    const existingUrls = await storage.get<BoxItem[]>("popularActiveUrls");
    if (!existingUrls) {
      await storage.set("popularActiveUrls", []);
    }

    await updateExtensionIcon();
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
});

// Listen for storage changes
browserAPI.storage.onChanged.addListener(async (changes, namespace) => {
  // If either extensionState or popularActiveUrls changes, update the icon
  if (changes.extensionState || changes.popularActiveUrls) {
    await updateExtensionIcon();
  }
});

// Listen for tab updates to check URL changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateExtensionIcon();
});

// Listen for tab URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    await updateExtensionIcon();
  }
});

// Check conditions when extension loads
chrome.runtime.onStartup.addListener(async () => {
  await updateExtensionIcon();
});

// Check conditions when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  await updateExtensionIcon();
});

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