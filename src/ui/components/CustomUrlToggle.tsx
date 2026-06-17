import {
  addSitePatternToList,
  createSiteListPatternToggleUpdate,
  createSiteListToggleUpdate,
  createSitePathPatternFromUrl,
  createSitePatternFromUrl,
  getDisplaySitePattern,
  getMatchingSiteListPattern,
  getSitePatternScope,
  getURLHostOrProtocol,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList,
  removeSitePatternFromList
} from "../../config/site-list"
import { getMatchingWebsite } from "../../config/site-manager"
import { POPULAR_WEBSITES } from "../../config/sites"
import { STORAGE_KEYS } from "../../config/storage"
import type { WebsiteItem } from "../../definitions"
import { cn } from "../../utils/cn"
import { createRegexFromUrl } from "../../utils/url"
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
import { SiteScopeBadge, type SiteScopeBadgeKind } from "./SiteScopeBadge"

const activeCheckClasses = {
  custom: "border-slate-500 bg-slate-500",
  domain: "border-[#2474FF] bg-[#2474FF]",
  global: "border-sky-500 bg-sky-500",
  path: "border-emerald-500 bg-emerald-500",
  regex: "border-amber-500 bg-amber-500"
} satisfies Record<SiteScopeBadgeKind, string>

function removeOptionalSitePattern(list: string[], pattern: string | null) {
  return pattern ? removeSitePatternFromList(list, pattern) : list
}

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

  const currentUrl = currentTab?.url ?? null
  const matchingPopularWebsite = currentUrl
    ? getMatchingWebsite(currentUrl, POPULAR_WEBSITES)
    : null
  const normalizedEnabledByDefault = normalizeEnabledByDefault(enabledByDefault)
  const normalizedEnabledFor = normalizeEnabledSiteList(enabledFor)
  const normalizedDisabledFor = normalizeSiteList(disabledFor)
  const siteListSettings = {
    disabledFor: normalizedDisabledFor,
    enabledByDefault: normalizedEnabledByDefault,
    enabledFor: normalizedEnabledFor
  }
  const domainPattern = currentUrl ? createSitePatternFromUrl(currentUrl) : null
  const pathPattern = currentUrl
    ? createSitePathPatternFromUrl(currentUrl)
    : null
  const activeEnabledPattern = currentUrl
    ? getMatchingSiteListPattern(currentUrl, normalizedEnabledFor)
    : null
  const active = currentUrl
    ? isSiteListUrlEnabled(currentUrl, siteListSettings)
    : false
  const activePattern = active
    ? (activeEnabledPattern ??
      (normalizedEnabledByDefault ? null : domainPattern))
    : null
  const activeScope: SiteScopeBadgeKind | null = active
    ? activePattern
      ? getSitePatternScope(activePattern)
      : normalizedEnabledByDefault
        ? "global"
        : null
    : null
  const createUpdatedWebsiteList = (currentUrl: string, checked: boolean) => {
    const existingWebsiteIndex = websiteList.findIndex(
      (item) => getMatchingWebsite(currentUrl, [item]) !== null
    )

    return existingWebsiteIndex === -1 && checked
      ? [
          ...websiteList,
          {
            url: currentUrl,
            regex: createRegexFromUrl(currentUrl),
            isActive: true
          }
        ]
      : websiteList.map((item, index) =>
          index === existingWebsiteIndex ? { ...item, isActive: checked } : item
        )
  }

  const handlePatternToggle = async (pattern: string, checked: boolean) => {
    const currentUrl = currentTab?.url
    if (!currentUrl) return

    const siteListUpdate = createSiteListPatternToggleUpdate(
      pattern,
      {
        disabledFor,
        enabledByDefault,
        enabledFor
      },
      checked
    )

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
        [STORAGE_KEYS.WEBSITE_LIST]: createUpdatedWebsiteList(
          currentUrl,
          checked
        )
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update custom URL setting.", error)
      }
    }
  }

  const saveSiteListSettings = async (
    nextSettings: Pick<typeof siteListSettings, "disabledFor" | "enabledFor">,
    checked: boolean
  ) => {
    if (!currentUrl) return

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: nextSettings.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: nextSettings.enabledFor,
        [STORAGE_KEYS.WEBSITE_LIST]: createUpdatedWebsiteList(
          currentUrl,
          checked
        )
      })
    } catch (error) {
      if (__DEBUG__) {
        console.warn("Failed to update custom URL setting.", error)
      }
    }
  }

  const handleUrlToggle = async (checked: boolean) => {
    if (!currentUrl) return

    if (checked) {
      if (domainPattern) {
        await saveSiteListSettings(
          {
            disabledFor: removeOptionalSitePattern(
              removeSitePatternFromList(normalizedDisabledFor, domainPattern),
              pathPattern
            ),
            enabledFor: addSitePatternToList(
              removeOptionalSitePattern(normalizedEnabledFor, pathPattern),
              domainPattern
            )
          },
          true
        )
        return
      }

      const siteListUpdate = createSiteListToggleUpdate(
        currentUrl,
        {
          disabledFor,
          enabledByDefault,
          enabledFor
        },
        checked
      )
      await saveSiteListSettings(siteListUpdate, true)
      return
    }

    const patternToDisable = activePattern ?? domainPattern
    if (patternToDisable) {
      await handlePatternToggle(patternToDisable, false)
      return
    }

    if (!domainPattern) {
      const siteListUpdate = createSiteListToggleUpdate(
        currentUrl,
        {
          disabledFor,
          enabledByDefault,
          enabledFor
        },
        checked
      )
      try {
        await fontaraConnector.changeSettings({
          [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
          [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
          [STORAGE_KEYS.WEBSITE_LIST]: createUpdatedWebsiteList(
            currentUrl,
            checked
          )
        })
      } catch (error) {
        if (__DEBUG__) {
          console.warn("Failed to update custom URL setting.", error)
        }
      }
    }
  }

  if (!currentTab?.isSupported || !currentUrl || matchingPopularWebsite) {
    return null
  }

  const isRtl = direction === "rtl"
  const displayPattern =
    activePattern ?? domainPattern ?? getURLHostOrProtocol(currentUrl)
  const displaySiteName = getDisplaySitePattern(displayPattern)
  const checkClassName = active
    ? activeCheckClasses[activeScope ?? "domain"]
    : "border-gray-300 hover:border-[#2474FF]"
  const checkboxControl = (
    <div className="relative shrink-0">
      <input
        type="checkbox"
        name="customUrl"
        id="customUrl"
        className="peer sr-only"
        checked={active}
        onChange={(e) => void handleUrlToggle(e.target.checked)}
        data-testid="fontara-current-site-toggle-input"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 cursor-pointer items-center justify-center rounded border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[#2474FF]/30 peer-focus-visible:ring-offset-2",
          checkClassName
        )}>
        {active && <CheckIcon className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </div>
  )

  const siteIdentity = (
    <span
      className="inline-flex min-w-0 max-w-[12rem] items-center gap-1 align-middle"
      dir="ltr">
      {currentTab.favIconUrl && (
        <img
          src={currentTab.favIconUrl}
          className="!size-4 shrink-0 object-contain"
          alt="site icon"
        />
      )}
      <bdi className="truncate" dir="ltr" title={displaySiteName}>
        {displaySiteName}
      </bdi>
    </span>
  )

  return (
    <div
      className="border border-gray-200 rounded-md p-2 select-none mx-auto w-full mt-3"
      dir={direction}>
      <div
        className={`flex w-full items-center gap-2 ${
          isRtl ? "justify-end" : "justify-start"
        }`}
        dir="ltr">
        <label
          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs ${
            isRtl ? "justify-end" : "justify-start"
          }`}
          htmlFor="customUrl"
          data-testid="fontara-current-site-toggle">
          {!isRtl && checkboxControl}
          <div
            dir={direction}
            className="inline-flex min-w-0 max-w-full items-center justify-start gap-1">
            <span className="shrink-0">{t("customUrl.enableCurrentSite")}</span>
            {siteIdentity}
            {activeScope && <SiteScopeBadge scope={activeScope} />}
          </div>
          {isRtl && checkboxControl}
        </label>
      </div>
    </div>
  )
}

export default CustomUrlToggle
