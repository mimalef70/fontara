import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

import { STORAGE_KEYS } from "~src/lib/constants"

import { notifyAllTabs } from ".."

const storage = new Storage()

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const isExtensionEnabled = await storage.get<boolean>(
      STORAGE_KEYS.EXTENSION_ENABLED
    )
    if (!isExtensionEnabled) {
      res.send({ success: false, error: "Extension is disabled" })
      return
    }

    // const fontName = req.body?.fontName || req.font
    const fontName = req.body?.fontName

    await storage.set("selectedFont", fontName)
    await notifyAllTabs({
      action: "updateFont",
      fontName
    })

    res.send({ success: true })
  } catch (error) {
    res.send({ success: false, error })
  }
}

export default handler
