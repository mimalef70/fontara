import {
  createSiteListToggleUpdate,
  getActiveWebsiteSitePatterns,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../config/site-list"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { FontaraSettings, WebsiteItem } from "../definitions"
import { createRegexFromUrl, getMatchingWebsite } from "../utils/url"

export function createToggleExtensionSettings(
  settings: Record<string, unknown>
): FontaraSettings {
  return {
    [STORAGE_KEYS.EXTENSION_ENABLED]:
      settings[STORAGE_KEYS.EXTENSION_ENABLED] === false
  }
}

export function createToggleCurrentSiteSettings(
  url: string,
  settings: Record<string, unknown>
): FontaraSettings {
  const websiteList = Array.isArray(settings[STORAGE_KEYS.WEBSITE_LIST])
    ? (settings[STORAGE_KEYS.WEBSITE_LIST] as WebsiteItem[])
    : DEFAULT_VALUES.WEBSITE_LIST
  const enabledByDefault = normalizeEnabledByDefault(
    settings[STORAGE_KEYS.ENABLED_BY_DEFAULT]
  )
  const enabledFor =
    settings[STORAGE_KEYS.ENABLED_FOR] === undefined
      ? getActiveWebsiteSitePatterns(websiteList)
      : normalizeEnabledSiteList(settings[STORAGE_KEYS.ENABLED_FOR])
  const disabledFor =
    settings[STORAGE_KEYS.DISABLED_FOR] === undefined
      ? DEFAULT_VALUES.DISABLED_FOR
      : normalizeSiteList(settings[STORAGE_KEYS.DISABLED_FOR])
  const siteListSettings = {
    disabledFor,
    enabledByDefault,
    enabledFor
  }
  const checked = !isSiteListUrlEnabled(url, siteListSettings)
  const existingWebsiteIndex = websiteList.findIndex(
    (item) => getMatchingWebsite(url, [item]) !== null
  )
  const siteListUpdate = createSiteListToggleUpdate(
    url,
    siteListSettings,
    checked
  )
  const updatedWebsiteList =
    existingWebsiteIndex === -1 && checked
      ? [
          ...websiteList,
          {
            url,
            regex: createRegexFromUrl(url),
            isActive: true
          }
        ]
      : websiteList.map((item, index) =>
          index === existingWebsiteIndex ? { ...item, isActive: checked } : item
        )

  return {
    [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
    [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
    [STORAGE_KEYS.WEBSITE_LIST]: updatedWebsiteList
  }
}
