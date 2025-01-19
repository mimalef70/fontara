import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { notifyAllTabs } from ".."
import { DEFAULT_STATE } from "../constants/constant"
import type { BoxItem } from "../types/type"

const storage = new Storage()

export default async function handler(
  req: PlasmoMessaging.Request,
  res: PlasmoMessaging.Response
) {
  handleResetSettings(req, res.send)
  return { success: true }
}

async function handleResetSettings(
  message: any,
  sendResponse: (response?: any) => void
) {
  try {
    await storage.set("selectedFont", DEFAULT_STATE.defaultFont)
    await storage.set("customActiveUrls", [])

    const popularUrls = await storage.get<BoxItem[]>("popularActiveUrls")
    if (popularUrls) {
      const resetPopularUrls = popularUrls.map((url) => ({
        ...url,
        isActive: true
      }))
      await storage.set("popularActiveUrls", resetPopularUrls)
    }

    await notifyAllTabs({
      action: "settingsReset",
      defaultFont: DEFAULT_STATE.defaultFont
    })

    sendResponse({ success: true })
  } catch (error) {
    sendResponse({ success: false, error })
  }
}
