import { Storage } from "@plasmohq/storage"

const storage = new Storage()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.name === "changeFont") {
    storage.set("selectedFont", message.body.fontName)
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          action: "updateFont",
          fontName: message.body.fontName
        })
      })
    })
    sendResponse({ success: true })
  }
})

interface BoxItem {
  id: string
  src: string
  isActive: boolean
  url: string
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    checkIfUrlShouldBeActive(tab.url, tabId)
  }
})

async function checkIfUrlShouldBeActive(url: string, tabId: number) {
  const activeUrls = await storage.get<BoxItem[]>("activeUrls")
  // if (activeUrls) {
  const shouldBeActive = activeUrls.some(
    (item) =>
      item.isActive && new RegExp(item.url.replace(/\*/g, ".*")).test(url)
  )

  chrome.tabs.sendMessage(tabId, {
    action: "setActiveStatus",
    isActive: shouldBeActive
  })
}
// }
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateActiveUrls") {
    storage.set("activeUrls", message.activeUrls)
    // Notify all tabs to update their active URLs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        console.log(tab)
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            action: "updateActiveUrls",
            activeUrls: message.activeUrls
          })
        }
      })
    })
  }
})
