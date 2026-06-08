import {
  createSiteListToggleUpdate,
  getDisplaySitePattern,
  getURLHostOrProtocol,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../../config/site-list"
import { STORAGE_KEYS } from "../../config/storage"
import type { WebsiteItem } from "../../definitions"
import { createRegexFromUrl, getMatchingWebsite } from "../../utils/url"
import { fontaraConnector } from "../connect/connector"
import { useExtensionData } from "../hooks/use-extension-data"
import { useStorageValue } from "../hooks/use-storage"
import { useI18n } from "../i18n"
import {
  EMPTY_WEBSITE_LIST,
  getDisabledForInitialValue,
  getEnabledByDefaultInitialValue,
  getEnabledForInitialValue
} from "../storage-defaults"
import { Check as CheckIcon } from "./icons"

const CustomUrlToggle = () => {
  const { direction, t } = useI18n()
  const currentTab = useExtensionData()?.activeTab ?? null
  const [websiteList] = useStorageValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST,
    EMPTY_WEBSITE_LIST
  )
  const [enabledByDefault] = useStorageValue<boolean>(
    STORAGE_KEYS.ENABLED_BY_DEFAULT,
    getEnabledByDefaultInitialValue
  )
  const [enabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.ENABLED_FOR,
    getEnabledForInitialValue
  )
  const [disabledFor] = useStorageValue<string[]>(
    STORAGE_KEYS.DISABLED_FOR,
    getDisabledForInitialValue
  )

  const handleUrlToggle = async (checked: boolean) => {
    const currentUrl = currentTab?.url
    if (!currentUrl) return

    const existingWebsiteIndex = websiteList.findIndex(
      (item) => getMatchingWebsite(currentUrl, [item]) !== null
    )
    const siteListUpdate = createSiteListToggleUpdate(
      currentUrl,
      {
        disabledFor,
        enabledByDefault,
        enabledFor
      },
      checked
    )

    const updatedUrls =
      existingWebsiteIndex === -1 && checked
        ? [
            ...websiteList,
            {
              url: currentUrl,
              regex: createRegexFromUrl(currentUrl),
              isActive: true
            }
          ]
        : websiteList.map((item, index) =>
            index === existingWebsiteIndex
              ? { ...item, isActive: checked }
              : item
          )

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
        [STORAGE_KEYS.WEBSITE_LIST]: updatedUrls
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update custom URL setting.", error)
      }
    }
  }

  const isUrlActive = (): boolean => {
    if (!currentTab?.url) return false

    return isSiteListUrlEnabled(currentTab.url, {
      disabledFor: normalizeSiteList(disabledFor),
      enabledByDefault: normalizeEnabledByDefault(enabledByDefault),
      enabledFor: normalizeEnabledSiteList(enabledFor)
    })
  }

  const active = isUrlActive()
  const currentUrl = currentTab?.url

  if (!currentTab?.isSupported || !currentUrl) return null

  const isRtl = direction === "rtl"
  const hostName = getDisplaySitePattern(
    getURLHostOrProtocol(currentUrl)
  ).slice(0, 25)
  const checkboxControl = (
    <div className="relative shrink-0">
      <input
        type="checkbox"
        name="customUrl"
        id="customUrl"
        className="peer sr-only"
        checked={active}
        onChange={(e) => void handleUrlToggle(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`flex size-4 cursor-pointer items-center justify-center rounded border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[#2474FF]/30 peer-focus-visible:ring-offset-2 ${
          active
            ? "bg-[#2474FF] border-[#2474FF]"
            : "border-gray-300 hover:border-[#2474FF]"
        }`}>
        {active && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </div>
  )

  const siteIdentity = (
    <span
      className="inline-flex min-w-0 max-w-[8.5rem] items-center gap-1 align-middle"
      dir="ltr">
      {currentTab.favIconUrl && (
        <img
          src={currentTab.favIconUrl}
          className="!size-4 shrink-0 object-contain"
          alt="site icon"
        />
      )}
      <bdi className="truncate" dir="ltr">
        {hostName}
      </bdi>
    </span>
  )

  return (
    <div
      className="border border-gray-200 rounded-md p-2 select-none mx-auto w-full mt-3"
      dir={direction}>
      <label
        className="block cursor-pointer overflow-y-hidden text-xs"
        htmlFor="customUrl">
        <div
          className={`flex w-full items-center gap-2 ${
            isRtl ? "justify-end" : "justify-start"
          }`}
          dir="ltr">
          {!isRtl && checkboxControl}
          <div
            dir={direction}
            className="inline-flex min-w-0 max-w-full items-center justify-start gap-1">
            <span className="shrink-0">{t("customUrl.enablePrefix")}</span>
            {siteIdentity}
            <span className="shrink-0">{t("customUrl.enableSuffix")}</span>
          </div>
          {isRtl && checkboxControl}
        </div>
      </label>
    </div>
  )
}

export default CustomUrlToggle
