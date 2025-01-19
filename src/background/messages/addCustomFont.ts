import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { notifyAllTabs } from ".."

const storage = new Storage()

export default async function handler(
  req: PlasmoMessaging.Request,
  res: PlasmoMessaging.Response
) {
  handleAddCustomFont(req, res.send)
  return { success: true }
}

async function handleAddCustomFont(
  message: any,
  sendResponse: (response?: any) => void
) {
  try {
    const extensionState = (await storage.get("extensionState")) as any
    if (!extensionState?.isEnabled) {
      sendResponse({ success: false, error: "Extension is disabled" })
      return
    }

    const customFonts = (await storage.get("customFonts")) || []
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
    sendResponse({ success: false, error })
  }
}
