import {
  getRtlSiteByUrl,
  isRtlSiteEnabled,
  normalizeRtlSiteSettings,
  type RtlSiteSettings
} from "../../config/rtl-sites"
import { STORAGE_KEYS } from "../../config/storage"
import { getExtensionAssetURL } from "../../utils/assets"
import { useExtensionData } from "../hooks/use-extension-data"
import { useStorageValue } from "../hooks/use-storage"
import { useI18n } from "../i18n"
import {
  getRtlEnabledInitialValue,
  getRtlSiteSettingsInitialValue
} from "../storage-defaults"
import { Switch } from "./ui/Switch"

const RtlSiteToggle = () => {
  const { direction, t } = useI18n()
  const currentTab = useExtensionData()?.activeTab ?? null
  const [rtlEnabled, setRtlEnabled] = useStorageValue<boolean>(
    STORAGE_KEYS.RTL_ENABLED,
    getRtlEnabledInitialValue
  )
  const [rtlSiteSettings, setRtlSiteSettings] =
    useStorageValue<RtlSiteSettings>(
      STORAGE_KEYS.RTL_SITE_SETTINGS,
      getRtlSiteSettingsInitialValue
    )

  const currentUrl = currentTab?.url ?? undefined
  const matchingSite = getRtlSiteByUrl(currentUrl)

  if (!matchingSite || !currentTab?.isSupported || !currentUrl) return null

  const isRtl = direction === "rtl"
  const normalizedSettings = normalizeRtlSiteSettings(rtlSiteSettings)
  const siteEnabled = isRtlSiteEnabled(normalizedSettings, matchingSite.id)
  const active = rtlEnabled !== false && siteEnabled

  const handleToggle = async (checked: boolean) => {
    const nextSettings: RtlSiteSettings = {
      ...normalizedSettings,
      [matchingSite.id]: checked
    }

    try {
      await Promise.all([
        setRtlSiteSettings(nextSettings),
        checked && rtlEnabled === false
          ? setRtlEnabled(true)
          : Promise.resolve()
      ])
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update RTL site setting.", error)
      }
    }
  }

  const switchControl = (
    <Switch
      dir="ltr"
      checked={active}
      onCheckedChange={(checked) => void handleToggle(checked)}
      aria-label={t("options.rtl.siteToggleAria", {
        site: matchingSite.siteName
      })}
    />
  )

  return (
    <div
      className="mx-auto mt-2 w-full select-none rounded-md border border-gray-200 p-2"
      dir={direction}>
      <div className="block text-xs">
        <div
          className={`flex w-full items-center gap-2 ${
            isRtl ? "justify-end" : "justify-start"
          }`}
          dir="ltr">
          {!isRtl && switchControl}
          <div
            dir={direction}
            className="inline-flex min-w-0 max-w-full items-center justify-start gap-1">
            <img
              alt=""
              src={getExtensionAssetURL(matchingSite.icon)}
              className="size-4 shrink-0 rounded-sm object-contain"
            />
            <span className="truncate">
              {t("popup.rtl.currentSite", { site: matchingSite.siteName })}
            </span>
            {!rtlEnabled && (
              <span className="shrink-0 text-[10px] text-gray-400">
                {t("popup.rtl.globallyDisabled")}
              </span>
            )}
          </div>
          {isRtl && switchControl}
        </div>
      </div>
    </div>
  )
}

export default RtlSiteToggle
