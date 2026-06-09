import { version } from "../../../../package.json"
import { STORAGE_KEYS, URLS } from "../../../config/storage"
import { getExtensionAssetURL } from "../../../utils/assets"
import { cn } from "../../../utils/cn"
import { useStorageValue } from "../../hooks/use-storage"
import { useI18n } from "../../i18n"
import { getExtensionEnabledInitialValue } from "../../storage-defaults"
import { Badge } from "../ui/badge"
import { Switch } from "../ui/Switch"

const Header = () => {
  const { direction, formatVersion, t } = useI18n()
  const [extensionActive, setExtensionActive] = useStorageValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED,
    getExtensionEnabledInitialValue
  )

  const handleExtensionToggle = async (checked: boolean) => {
    try {
      await setExtensionActive(checked)
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update extension enabled state.", error)
      }
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between pb-3 z-10 w-full",
        direction === "ltr" && "flex-row-reverse"
      )}>
      <div className="flex items-center gap-2">
        <Switch
          dir="ltr"
          checked={extensionActive}
          onCheckedChange={handleExtensionToggle}
          aria-label={t("header.toggleAriaLabel")}
          data-testid="fontara-extension-enabled-toggle"
        />
      </div>

      <div
        className={cn(
          "flex items-center gap-2",
          direction === "ltr" && "flex-row-reverse"
        )}>
        <Badge className="!border-gray-200 !bg-gray-100 !px-2 !py-[1px] !text-[9px] !font-medium !text-gray-500 hover:!bg-gray-100">
          <a
            href={URLS.CHANGELOG}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer">
            {t("common.version", { version: formatVersion(version) })}
          </a>
        </Badge>
        <a
          href={URLS.WELCOME_PAGE}
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
