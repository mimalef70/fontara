import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { STORAGE_KEYS } from "~src/lib/constants"

import { notifyAllTabs } from ".."

const storage = new Storage()
export default async function handler(
  req: PlasmoMessaging.Request,
  res: PlasmoMessaging.Response
) {
  handlePopularUrlsUpdate(req, res.send)

  return { success: true }
}

async function handlePopularUrlsUpdate(
  message: PlasmoMessaging.Request,
  sendResponse: (response?: any) => void
) {
  try {
    const isExtensionEnabled = await storage.get<boolean>(
      STORAGE_KEYS.EXTENSION_ENABLED
    )
    if (!isExtensionEnabled) {
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
