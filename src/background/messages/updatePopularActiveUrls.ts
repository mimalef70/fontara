import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { notifyAllTabs } from ".."
import type { ExtensionState } from "../types/type"

const storage = new Storage()
export default async function handler(
  req: PlasmoMessaging.Request,
  res: PlasmoMessaging.Response
) {
  handlePopularUrlsUpdate(req, res.send)

  console.log("Background received updatePopularActiveUrls message:", req)
  return { success: true }
}

async function handlePopularUrlsUpdate(
  message: PlasmoMessaging.Request,
  sendResponse: (response?: any) => void
) {
  try {
    const extensionState = await storage.get<ExtensionState>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    await storage.set("popularActiveUrls", message.body)
    await notifyAllTabs({
      action: "updatePopularActiveUrls",
      popularActiveUrls: message.body
    })
    sendResponse({ success: true })
  } catch (error) {
    sendResponse({ success: false, error })
  }
}
