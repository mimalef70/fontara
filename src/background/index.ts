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

// Unified message listener for font changes and custom URL updates
browserAPI.runtime.onMessage.addListener(
  (message: any, sender: any, sendResponse: (response?: any) => void) => {
    if (message.name === "changeFont") {
      handleFontChange(message, sendResponse)
    } else if (message.action === "updateCustomUrlStatus") {
      handleCustomUrlUpdate(message, sendResponse)
    } else if (message.action === "updatePopularActiveUrls") {
      handlePopularUrlsUpdate(message, sendResponse)
    }
  }
)

// Handle font change messages
function handleFontChange(message: any, sendResponse: (response?: any) => void) {
  storage.set("selectedFont", message.body.fontName)
  notifyAllTabs({
    action: "updateFont",
    fontName: message.body.fontName
  })
  sendResponse({ success: true })
}

// Handle custom URL status updates
function handleCustomUrlUpdate(message: any, sendResponse: (response?: any) => void) {
  console.log("Updating custom URL status:", message.data)
  storage.set("customActiveUrls", message.data)
  notifyAllTabs({
    action: "updateCustomUrlStatus",
    data: message.data
  })
  sendResponse({ success: true })
}

// Handle popular URLs updates
function handlePopularUrlsUpdate(message: any, sendResponse: (response?: any) => void) {
  console.log("Updating popular URLs:", message.popularActiveUrls)
  storage.set("popularActiveUrls", message.popularActiveUrls)
  notifyAllTabs({
    action: "updatePopularActiveUrls",
    popularActiveUrls: message.popularActiveUrls
  })
  sendResponse({ success: true })
}

// Utility function to notify all tabs
function notifyAllTabs(message: any) {
  browserAPI.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
    tabs.forEach((tab) => {
      if (tab.id !== undefined) {
        browserAPI.tabs
          .sendMessage(tab.id, message)
          .catch((error: Error) =>
            console.error("Error sending message:", error)
          )
      }
    })
  })
}

// Listen for tab updates
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

// Check if URL should be active by checking both custom and popular URLs
async function checkIfUrlShouldBeActive(url: string, tabId: number) {
  try {
    // Check popular URLs first
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

    // Check custom URLs if no match in popular URLs
    const customActiveUrls = await storage.get<BoxItem[]>("customActiveUrls")
    if (customActiveUrls) {
      const isCustomActive = customActiveUrls.some(
        (item) =>
          item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
      )

      sendActiveStatus(tabId, isCustomActive)
      return isCustomActive
    }

    // If neither found or active, send inactive status
    sendActiveStatus(tabId, false)
    return false

  } catch (error) {
    console.error("Error checking URL active status:", error)
    return false
  }
}

// Utility function to send active status to tab
function sendActiveStatus(tabId: number, isActive: boolean) {
  browserAPI.tabs
    .sendMessage(tabId, {
      action: "setActiveStatus",
      isActive: isActive
    })
    .catch((error: Error) => console.error("Error sending message:", error))
}