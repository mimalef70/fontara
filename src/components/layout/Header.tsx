import { useEffect } from "react"
import logo from "url:~assets/newlogo.svg"

import { Storage } from "@plasmohq/storage"

import { Switch } from "~src/components/ui/switch"

import { Badge } from "../ui/badge"

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

const Header = ({ extentionEnabledState, setExtentionEnabledState }) => {
  // useEffect(() => {
  //   const initializeExtensionState = async () => {
  //     const storedState = await storage.get<boolean>("isExtensionEnabled")
  //     setExtentionEnabledState(storedState ?? true)
  //   }

  //   initializeExtensionState()
  // }, [])

  const handleExtensionToggle = async () => {
    try {
      const newState = !extentionEnabledState
      setExtentionEnabledState(newState)

      // Save to storage
      const currentFont = await storage.get("selectedFont")
      await storage.set("isExtensionEnabled", newState)
      await storage.set("extensionState", {
        defaultFont: currentFont,
        isEnabled: newState
      })

      // Send message to background script
      browserAPI.runtime.sendMessage({
        action: "toggleExtension",
        isEnabled: newState
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
            // Silent catch for inactive tabs
          }
        }
      }
    } catch (error) {
      setExtentionEnabledState(!extentionEnabledState)
    }
  }

  return (
    <div className="flex justify-between z-9 pb-3">
      <div className="flex items-center gap-2">
        <img src={logo} alt="" className="relative w-[65%]" />
        <Badge className="z-10 !text-[10px] !py-[2px] !bg-red-500 hover:!bg-red-600">
          ورژن ۴
        </Badge>
      </div>
      <Switch
        dir="ltr"
        checked={extentionEnabledState}
        onCheckedChange={handleExtensionToggle}
      />
    </div>
  )
}

export default Header
