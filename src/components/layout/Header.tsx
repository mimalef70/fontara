import logo from "url:~assets/newlogo.svg"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { STORAGE_KEYS } from "~src/lib/constants"

import { Badge } from "../ui/badge"
import { Switch } from "../ui/Switch"

const Header = () => {
  const [extensionActive, setExtensionActive] = useStorage(
    {
      key: STORAGE_KEYS.EXTENSION_ENABLED,
      instance: new Storage({
        area: "local"
      })
    },
    (v) => (v === undefined ? true : v)
  )

  const handleExtensionToggle = async (checked: boolean) => {
    try {
      setExtensionActive(checked)

      // Save to storage
      // const currentFont = await storage.get("selectedFont")
      // await storage.set("extensionState", {
      //   defaultFont: currentFont,
      //   isEnabled: checked
      // })

      // Send message to background script
      chrome.runtime.sendMessage({
        action: "toggleExtension",
        isEnabled: checked
      })

      // Update all tabs
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (tab.id && tab.url && tab.url.startsWith("http")) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: "toggle",
              isExtensionEnabled: checked
            })
          } catch (error) {
            // Silent catch for inactive tabs
          }
        }
      }
    } catch (error) {
      setExtensionActive(checked)
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
        checked={extensionActive}
        onCheckedChange={handleExtensionToggle}
      />
    </div>
  )
}

export default Header
