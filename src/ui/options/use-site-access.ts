import type React from "react"
import { useState } from "react"
import {
  createSiteListPatternAddUpdate,
  createSitePathPatternFromUrl,
  createSitePatternFromUrl,
  createWebsiteSiteListToggleUpdate,
  getDisplaySitePattern,
  getMatchingSiteListPattern,
  getWebsiteSitePattern,
  inferSitePatternScopeFromInput,
  isSiteListUrlEnabled,
  isURLMatched,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList,
  normalizeSitePattern,
  normalizeSitePatternForScope,
  removeSitePatternFromList,
  type SitePatternScope
} from "../../config/site-list"
import { normalizePinnedWebsiteUrls } from "../../config/sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../../config/storage"
import type { WebsiteItem } from "../../definitions"
import { fontaraConnector } from "../connect/connector"
import { createCustomCssProbeUrl } from "./site-access-helpers"

import type { OptionsState } from "./use-options-state"

export function useSiteAccess({
  pinnedWebsiteUrls,
  enabledByDefault,
  enabledFor,
  disabledFor,
  currentTab,
  websiteList,
  toast,
  t,
  setPinnedWebsiteUrls,
  setEnabledByDefault
}: Pick<
  OptionsState,
  | "pinnedWebsiteUrls"
  | "enabledByDefault"
  | "enabledFor"
  | "disabledFor"
  | "currentTab"
  | "websiteList"
  | "toast"
  | "t"
  | "setPinnedWebsiteUrls"
  | "setEnabledByDefault"
>) {
  const [sitePatternScope, setSitePatternScope] =
    useState<SitePatternScope>("domain")

  const [sitePatternInput, setSitePatternInput] = useState("")

  const defaultWebsiteList = DEFAULT_VALUES.WEBSITE_LIST

  const normalizedPinnedWebsiteUrls = normalizePinnedWebsiteUrls(
    pinnedWebsiteUrls,
    []
  )

  const pinnedWebsiteUrlSet = new Set(normalizedPinnedWebsiteUrls)

  const normalizedEnabledByDefault = normalizeEnabledByDefault(enabledByDefault)

  const normalizedEnabledFor = normalizeEnabledSiteList(enabledFor)

  const normalizedDisabledFor = normalizeSiteList(disabledFor)

  const siteListSettings = {
    disabledFor: normalizedDisabledFor,
    enabledByDefault: normalizedEnabledByDefault,
    enabledFor: normalizedEnabledFor
  }

  const managedSiteList = normalizedEnabledByDefault
    ? normalizedDisabledFor
    : normalizedEnabledFor

  const trimmedSitePatternInput = sitePatternInput.trim()

  const normalizedSitePatternInput = normalizeSitePatternForScope(
    sitePatternInput,
    sitePatternScope
  )

  const hasSitePatternInput = trimmedSitePatternInput.length > 0

  const currentTabDomainPattern = currentTab?.url
    ? createSitePatternFromUrl(currentTab.url)
    : null

  const currentTabPathPattern = currentTab?.url
    ? createSitePathPatternFromUrl(currentTab.url)
    : null

  const currentTabHasPathPattern =
    Boolean(currentTabPathPattern) &&
    Boolean(currentTabDomainPattern) &&
    currentTabPathPattern !== currentTabDomainPattern

  const activeWebsiteCount = defaultWebsiteList.filter((website) =>
    isSiteListUrlEnabled(website.url, siteListSettings)
  ).length

  const cssOnlyWebsiteCount = defaultWebsiteList.filter(
    (website) => website.customCss === true
  ).length

  const handleWebsiteToggle = async (website: WebsiteItem) => {
    const currentWebsiteList =
      websiteList.length > 0 ? websiteList : DEFAULT_VALUES.WEBSITE_LIST
    const active = isWebsiteActive(website)
    const existingWebsiteIndex = currentWebsiteList.findIndex(
      (item) => item.url === website.url
    )
    const updatedWebsiteList =
      existingWebsiteIndex === -1
        ? [...currentWebsiteList, { ...website, isActive: !active }]
        : currentWebsiteList.map((item, index) =>
            index === existingWebsiteIndex
              ? { ...item, isActive: !active }
              : item
          )
    const siteListUpdate = createWebsiteSiteListToggleUpdate(
      website,
      siteListSettings,
      !active
    )

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
        [STORAGE_KEYS.WEBSITE_LIST]: updatedWebsiteList
      })
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleWebsitePinToggle = async (website: WebsiteItem) => {
    try {
      await setPinnedWebsiteUrls((currentPinnedUrls) => {
        const nextPinnedUrlSet = new Set(
          normalizePinnedWebsiteUrls(currentPinnedUrls, [])
        )

        if (nextPinnedUrlSet.has(website.url)) {
          nextPinnedUrlSet.delete(website.url)
        } else {
          nextPinnedUrlSet.add(website.url)
        }

        return defaultWebsiteList
          .map((defaultWebsite) => defaultWebsite.url)
          .filter((url) => nextPinnedUrlSet.has(url))
      })
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const isWebsiteActive = (website: WebsiteItem) => {
    return isSiteListUrlEnabled(website.url, siteListSettings)
  }

  const isWebsitePinned = (website: WebsiteItem) => {
    return pinnedWebsiteUrlSet.has(website.url)
  }

  const getWebsiteCardPattern = (website: WebsiteItem) => {
    const enabledPattern = getMatchingSiteListPattern(
      website.url,
      normalizedEnabledFor
    )
    if (enabledPattern) return enabledPattern

    const disabledPattern = getMatchingSiteListPattern(
      website.url,
      normalizedDisabledFor
    )
    return disabledPattern ?? getWebsiteSitePattern(website)
  }

  const getWebsiteCardTitle = (
    website: WebsiteItem,
    pattern: string | null
  ) => {
    return website.siteName || getDisplaySitePattern(pattern ?? website.url)
  }

  const hasCustomCssForSitePattern = (pattern: string) => {
    const normalizedPattern = normalizeSitePattern(pattern)
    if (!normalizedPattern) return false

    return defaultWebsiteList.some((website) => {
      if (website.customCss !== true) return false

      return (
        isURLMatched(website.url, normalizedPattern) ||
        isURLMatched(
          createCustomCssProbeUrl(website, normalizedPattern),
          normalizedPattern
        )
      )
    })
  }

  const handleSiteListModeChange = async (nextEnabledByDefault: boolean) => {
    try {
      await setEnabledByDefault(nextEnabledByDefault)
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleAddSitePattern = async () => {
    const pattern = normalizedSitePatternInput

    if (!pattern) {
      toast({ title: t("options.toast.invalidSitePattern") })
      return
    }

    const siteListUpdate = createSiteListPatternAddUpdate(
      pattern,
      siteListSettings
    )

    try {
      await fontaraConnector.changeSettings({
        [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
        [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor
      })
      setSitePatternInput("")
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleRemoveSitePattern = async (pattern: string) => {
    const listKey = normalizedEnabledByDefault
      ? STORAGE_KEYS.DISABLED_FOR
      : STORAGE_KEYS.ENABLED_FOR
    const updatedList = removeSitePatternFromList(managedSiteList, pattern)

    try {
      await fontaraConnector.changeSettings({ [listKey]: updatedList })
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : t("options.toast.siteSettingsError")
      })
    }
  }

  const handleSitePatternSubmit = (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    void handleAddSitePattern()
  }

  const handleSitePatternInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = event.target.value
    setSitePatternInput(nextValue)
    setSitePatternScope(
      inferSitePatternScopeFromInput(nextValue, sitePatternScope)
    )
  }

  const fillSitePatternFromCurrentTab = (scope: SitePatternScope) => {
    if (!currentTab?.url) return

    const pattern =
      scope === "path"
        ? createSitePathPatternFromUrl(currentTab.url)
        : createSitePatternFromUrl(currentTab.url)

    if (!pattern) return

    setSitePatternScope(scope)
    setSitePatternInput(
      scope === "path" ? getDisplaySitePattern(pattern) : pattern
    )
  }
  return {
    sitePatternScope,
    setSitePatternScope,
    sitePatternInput,
    defaultWebsiteList,
    normalizedEnabledByDefault,
    managedSiteList,
    normalizedSitePatternInput,
    hasSitePatternInput,
    currentTabDomainPattern,
    currentTabHasPathPattern,
    activeWebsiteCount,
    cssOnlyWebsiteCount,
    handleWebsiteToggle,
    handleWebsitePinToggle,
    isWebsiteActive,
    isWebsitePinned,
    getWebsiteCardPattern,
    getWebsiteCardTitle,
    hasCustomCssForSitePattern,
    handleSiteListModeChange,
    handleRemoveSitePattern,
    handleSitePatternSubmit,
    handleSitePatternInputChange,
    fillSitePatternFromCurrentTab
  }
}
