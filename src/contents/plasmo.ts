import { Storage } from "@plasmohq/storage"

import * as FontManager from "~src/utils/function"
import type { BrowserMessage, MessageResponse } from "~src/utils/types"
import { browserAPI } from "~src/utils/utils"

const storage = new Storage()

//? Root style setup(For setting font-family in root element)
const rootStyle = document.createElement("style")
rootStyle.id = "fontara-root-styles"
document.head.appendChild(rootStyle)

//? Observer setup for tracking DOM changes(EX: New elements load while scrolling)
const observer = new MutationObserver(async (mutations: MutationRecord[]) => {
  const shouldApply = await FontManager.shouldApplyFonts()

  if (!shouldApply) {
    return
  }

  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          FontManager.getAllElementsWithFontFamily(node)
        }
      })
    } else if (
      mutation.type === "attributes" &&
      mutation.target instanceof HTMLElement &&
      mutation.attributeName === "style"
    ) {
      FontManager.getAllElementsWithFontFamily(mutation.target)
    }
  })
})

// Message listener(For handling messages from background script )
browserAPI.runtime.onMessage.addListener(
  (
    message: BrowserMessage,
    sender: any,
    sendResponse: (response: MessageResponse) => void
  ) => {
    ;(async () => {
      try {
        switch (message.action) {
          case "updatePopularActiveUrls":
            FontManager.setActivePopularUrls(
              message.popularActiveUrls
                .filter((item) => item.isActive)
                .map((item) => item.url)
            )
            await FontManager.initializeFonts()
            sendResponse({ success: true })
            break

          case "updateCustomUrlStatus":
            FontManager.setActiveCustomUrls(
              message.data
                .filter((item) => item.isActive)
                .map((item) => item.url)
            )
            await FontManager.initializeFonts()
            sendResponse({ success: true })
            break

          case "updateFont":
            const shouldApply = await FontManager.shouldApplyFonts()
            if (shouldApply) {
              FontManager.updateFont(message.fontName)
              await storage.set("selectedFont", message.fontName)
              sendResponse({ success: true })
            } else {
              sendResponse({
                success: false,
                error: "URL not matched or extension disabled."
              })
            }
            break

          case "setActiveStatus":
            if (message.isActive) {
              await FontManager.initializeFonts()
            }
            sendResponse({ success: true })
            break

          case "toggle":
            FontManager.setExtensionEnabled(message.isExtensionEnabled)
            if (message.isExtensionEnabled) {
              await FontManager.initialize()
            } else {
              FontManager.resetFontToDefault()
              observer.disconnect()
            }
            sendResponse({ success: true })
            break

          case "refreshFonts":
            await FontManager.initializeFonts()
            sendResponse({ success: true })
            break
        }
      } catch (error) {
        sendResponse({ success: false, error: String(error) })
      }
    })()
    return true
  }
)

export { rootStyle, observer }
