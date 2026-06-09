import {
  createSiteListToggleUpdate,
  isSiteListUrlEnabled
} from "../config/site-list"
import {
  getMatchingWebsite,
  normalizeFontaraSiteManagerSettings
} from "../config/site-manager"
import { STORAGE_KEYS } from "../config/storage"
import type { FontaraSettings } from "../definitions"
import { createRegexFromUrl } from "../utils/url"

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
  const snapshot = normalizeFontaraSiteManagerSettings(settings)
  const siteListSettings = {
    disabledFor: snapshot.disabledFor,
    enabledByDefault: snapshot.enabledByDefault,
    enabledFor: snapshot.enabledFor
  }
  const checked = !isSiteListUrlEnabled(url, siteListSettings)
  const existingWebsiteIndex = snapshot.websiteList.findIndex(
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
          ...snapshot.websiteList,
          {
            url,
            regex: createRegexFromUrl(url),
            isActive: true
          }
        ]
      : snapshot.websiteList.map((item, index) =>
          index === existingWebsiteIndex ? { ...item, isActive: checked } : item
        )

  return {
    [STORAGE_KEYS.DISABLED_FOR]: siteListUpdate.disabledFor,
    [STORAGE_KEYS.ENABLED_FOR]: siteListUpdate.enabledFor,
    [STORAGE_KEYS.WEBSITE_LIST]: updatedWebsiteList
  }
}
