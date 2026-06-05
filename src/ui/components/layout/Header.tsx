import { version } from "../../../../package.json"
import { STORAGE_KEYS } from "../../../config/storage"
import { getExtensionAssetURL } from "../../../utils/assets"
import { toPersianNumbers } from "../../../utils/text"
import { useStorageValue } from "../../hooks/use-storage"
import { getExtensionEnabledInitialValue } from "../../storage-defaults"
import { Badge } from "../ui/badge"
import { Switch } from "../ui/Switch"

const Header = () => {
  const [extensionActive, setExtensionActive] = useStorageValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED,
    getExtensionEnabledInitialValue
  )

  const handleExtensionToggle = async (checked: boolean) => {
    try {
      await setExtensionActive(checked)

      // Update all tabs
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (tab.id && tab.url?.startsWith("http")) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: "toggle",
              isExtensionEnabled: checked
            })
          } catch (_error) {
            // Silent catch for inactive tabs
          }
        }
      }
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update extension enabled state.", error)
      }
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
        <Badge className="!border-gray-200 !bg-gray-100 !px-2 !py-[1px] !text-[9px] !font-medium !text-gray-500 hover:!bg-gray-100">
          <a
            href="https://mimalef70.github.io/fontara/#changelogs"
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer">
            نسخه {toPersianNumbers(version)}
          </a>
        </Badge>
        <a
          href="https://mimalef70.github.io/fontara"
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer">
          <img
            src={getExtensionAssetURL("assets/newlogo.svg")}
            alt="logo"
            className="h-auto max-h-8"
          />
        </a>
      </div>
    </div>
  )
}

export default Header
