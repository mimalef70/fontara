import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { notifyAllTabs } from ".."

const storage = new Storage()

export default async function handler(
  req: PlasmoMessaging.Request,
  res: PlasmoMessaging.Response
) {
  handleCustomUrlUpdate(req, res.send)
  return { success: true }
}

async function handleCustomUrlUpdate(
  message: PlasmoMessaging.Request,
  sendResponse: (response?: any) => void
) {
  try {
    const extensionState = await storage.get<any>("extensionState")
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    await storage.set("customActiveUrls", message.body)
    await notifyAllTabs({
      action: "updateCustomUrlStatus",
      data: message.body
    })
    sendResponse({ success: true })
  } catch (error) {
    sendResponse({ success: false, error })
  }
}
