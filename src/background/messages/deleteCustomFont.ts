import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { notifyAllTabs } from ".."

const storage = new Storage()

export default async function handler(
  req: PlasmoMessaging.Request,
  res: PlasmoMessaging.Response
) {
  handleDeleteCustomFont(req, res.send)
  return { success: true }
}

async function handleDeleteCustomFont(
  message: any,
  sendResponse: (response?: any) => void
) {
  try {
    const customFonts: any = (await storage.get("customFonts")) || []
    const updatedFonts = customFonts.filter(
      (font) => font.name !== message.fontName
    )
    await storage.set("customFonts", updatedFonts)

    await notifyAllTabs({
      action: "deleteCustomFont",
      fontName: message.fontName
    })

    sendResponse({ success: true })
  } catch (error) {
    sendResponse({ success: false, error })
  }
}
