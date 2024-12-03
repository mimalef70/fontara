import { useEffect, useState } from "react"
import { Switch } from "~src/components/ui/switch"
import { Storage } from "@plasmohq/storage"


const storage = new Storage()
declare const chrome: any
declare const browser: any
const browserAPI: typeof chrome =
  typeof browser !== "undefined" ? browser : chrome

interface ExtensionState {
  isEnabled: boolean
  defaultFont: {
    value: string
    name: string
    svg: string
    style: string
  }
}

const DEFAULT_STATE: ExtensionState = {
  isEnabled: true,
  defaultFont: {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  }
}


const Header = ({ extentionEnabledState, setExtentionEnabledState }) => {

  useEffect(() => {
    const initializeExtensionState = async () => {
      // await storage.clear()
      const storedState = await storage.get<boolean>("isExtensionEnabled")
      setExtentionEnabledState(storedState ?? true) // Default to true if not set

    }

    initializeExtensionState()
  }, [])


  const handleExtensionToggle = async () => {
    try {
      const newState = !extentionEnabledState
      setExtentionEnabledState(newState)

      // Save to storage
      await storage.set("isExtensionEnabled", newState)
      await storage.set("extensionState", {
        ...DEFAULT_STATE,
        isEnabled: newState
      })

      // Send message to background script
      browserAPI.runtime.sendMessage({
        action: "toggleExtension",
        isEnabled: newState
      })

      await browserAPI.action.setIcon({
        path: newState
          ? {
            "16": "../../assets/icon-active-16.png"
          }
          : {
            "16": "../../assets/icon-16.png",
            "32": "../../assets/icon-32.png",
            "48": "../../assets/icon-48.png"
          }
      })

      // Update all tabs
      const tabs = await browserAPI.tabs.query({})
      for (const tab of tabs) {
        if (tab.id && tab.url && tab.url.startsWith("http")) {
          try {
            await browserAPI.tabs.sendMessage(tab.id, {
              action: "toggle",
              isExtensionEnabled: newState
            })
          } catch (error) {
            console.log(`Error sending message to tab ${tab.id}:`, error)
          }
        }
      }
    } catch (error) {
      console.error("Error toggling extension:", error)
      setExtentionEnabledState(!extentionEnabledState)
    }
  }

  return (
    <div className="flex justify-between relative z-9">
      <p className="text-center mb-2 text-xl text-blue-800">v2فونت آرا</p>
      <Switch
        dir="ltr"
        checked={extentionEnabledState}
        onCheckedChange={handleExtensionToggle}
      />
    </div>
  )
}

export default Header
