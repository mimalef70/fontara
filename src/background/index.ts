import { Storage } from "@plasmohq/storage"

const storage = new Storage()

// Declare type for browserAPI
declare const chrome: any
declare const browser: any

// Use browser for Firefox compatibility, fall back to chrome for Chrome
const browserAPI: typeof chrome =
  typeof browser !== "undefined" ? browser : chrome

browserAPI.runtime.onMessage.addListener(
  (message: any, sender: any, sendResponse: (response?: any) => void) => {
    if (message.name === "changeFont") {
      storage.set("selectedFont", message.body.fontName)
      browserAPI.tabs.query({}, (tabs: any[]) => {
        tabs.forEach((tab) => {
          if (tab.id !== undefined) {
            browserAPI.tabs
              .sendMessage(tab.id, {
                action: "updateFont",
                fontName: message.body.fontName
              })
              .catch((error: Error) =>
                console.error("Error sending message:", error)
              )
          }
        })
      })
      sendResponse({ success: true })
    } else if (message.action === "updateCustomUrlStatus") {
      console.log(message.action, message.data)
      storage.set("customUrlStatus", message.data)
      browserAPI.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
        tabs.forEach((tab) => {
          if (tab.id !== undefined) {
            browserAPI.tabs
              .sendMessage(tab.id, {
                action: "updateCustomUrlStatus",
                data: message.data
              })
              .catch((error: Error) =>
                console.error("Error sending message:", error)
              )
          }
        })
      })
      sendResponse({ success: true })
    }
  }
)

interface BoxItem {
  id: string
  src: string
  isActive: boolean
  url: string
}

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

async function checkIfUrlShouldBeActive(url: string, tabId: number) {
  const activeUrls = await storage.get<BoxItem[]>("activeUrls")
  if (activeUrls) {
    const shouldBeActive = activeUrls.some(
      (item) =>
        item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
    )

    browserAPI.tabs
      .sendMessage(tabId, {
        action: "setActiveStatus",
        isActive: shouldBeActive
      })
      .catch((error: Error) => console.error("Error sending message:", error))
  }
  return true
}

browserAPI.runtime.onMessage.addListener(
  (message: any, sender: any, sendResponse: (response?: any) => void) => {
    if (message.action === "updateActiveUrls") {
      storage.set("activeUrls", message.activeUrls)
      // Notify all tabs to update their active URLs
      browserAPI.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
        tabs.forEach((tab) => {
          if (tab.id !== undefined) {
            browserAPI.tabs
              .sendMessage(tab.id, {
                action: "updateActiveUrls",
                activeUrls: message.activeUrls
              })
              .catch((error: Error) =>
                console.error("Error sending message:", error)
              )
          }
        })
      })
    }
    sendResponse({ success: true })
  }
)

// browserAPI.runtime.onMessage.addListener(
//   (message: any, sender: any, sendResponse: (response?: any) => void) => {
//     if (message.action === "updateCustomUrlStatus") {
//       console.log(message.action, message.data)
//       storage.set("customUrlStatus", message.data)
//       browserAPI.tabs.query({}, (tabs: chrome.tabs.Tab[]) => {
//         tabs.forEach((tab) => {
//           if (tab.id !== undefined) {
//             browserAPI.tabs
//               .sendMessage(tab.id, {
//                 action: "updateCustomUrlStatus",
//                 data: message.data
//               })
//               .catch((error: Error) =>
//                 console.error("Error sending message:", error)
//               )
//           }
//         })
//       })
//     }
//   }
// )
