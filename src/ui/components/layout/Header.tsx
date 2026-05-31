import { version } from "../../../../package.json"
import { STORAGE_KEYS } from "../../../config/storage"
import { getExtensionAssetURL } from "../../../utils/assets"
import { toPersianNumbers } from "../../../utils/text"
import { useStorageValue } from "../../hooks/use-storage"
import { Badge } from "../ui/badge"
import { Switch } from "../ui/Switch"

const Header = () => {
  const [extensionActive, setExtensionActive] = useStorageValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED,
    (v) => (v === undefined ? true : v)
  )

  const handleExtensionToggle = async (checked: boolean) => {
    try {
      await setExtensionActive(checked)

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
