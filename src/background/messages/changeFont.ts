import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { notifyAllTabs } from ".."

const storage = new Storage()
export default async function handler(
  req: PlasmoMessaging.Request,
  res: PlasmoMessaging.Response
) {
  console.log("changeFont message", req)
  handleFontChange(req, res.send)

  return { success: true }
}

async function handleFontChange(
  message: any,
  sendResponse: (response?: any) => void
) {
  try {
    const extensionState = (await storage.get("extensionState")) as any
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
    sendResponse({ success: false, error })
  }
}
