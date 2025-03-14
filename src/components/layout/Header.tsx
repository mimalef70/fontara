import logo from "url:~assets/newlogo.svg"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

import { STORAGE_KEYS } from "~src/lib/constants"
import { toPersianNumbers } from "~src/lib/utils"

import { version } from "../../../package.json"
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
    <div className="flex items-center justify-between pb-3 z-10 w-full">
      <div className="flex items-center gap-2">
        <Switch
          dir="ltr"
          checked={extensionActive}
          onCheckedChange={handleExtensionToggle}
        />
      </div>

      <div className="flex items-center gap-2">
        <Badge className="!text-[10px] !py-[2px] !bg-red-500 hover:!bg-red-600">
          <a
            onClick={() => {
              window.open(
                "https://mimalef70.github.io/fontara/#changelogs",
                "_blank"
              )
            }}
            className="cursor-pointer">
            نسخه {toPersianNumbers(version)}
          </a>
        </Badge>
        <a
          onClick={() => {
            window.open(
              "https://mimalef70.github.io/fontara",
              "_blank"
            )
          }}
          className="cursor-pointer">
          <img src={logo} alt="logo" className="h-auto max-h-8" />
        </a>  
      </div>
    </div>
  )
}

export default Header
