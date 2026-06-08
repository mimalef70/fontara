import type { SiteProfile, WebsiteItem } from "../definitions"
import {
  getRtlSiteByUrl,
  isRtlSiteEnabled,
  normalizeRtlSiteSettings,
  type RtlSiteConfig,
  type RtlSiteSettings
} from "./rtl-sites"
import {
  getActiveWebsiteSitePatterns,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "./site-list"
import { getSiteProfileForUrl } from "./site-profiles"
import { DEFAULT_VALUES, STORAGE_KEYS } from "./storage"

export type FontaraSiteActivationState = {
  active: boolean
  matchingWebsite: WebsiteItem | null
  siteProfile: SiteProfile | null
}

export type FontaraRtlActivationState = {
  active: boolean
  globalEnabled: boolean
  masterEnabled: boolean
  matchingSite: RtlSiteConfig | null
  siteEnabled: boolean
  siteSettings: RtlSiteSettings
}

export type FontaraResolvedSiteConfig = {
  font: FontaraSiteActivationState
  rtl: FontaraRtlActivationState
}

function getSetting<T>(
  settings: Record<string, unknown>,
  key: string,
  fallback: T
): T {
  const value = settings[key]
  return value === undefined ? fallback : (value as T)
}

export function getWebsiteListFromSettings(
  settings: Record<string, unknown>
): WebsiteItem[] {
  const value = settings[STORAGE_KEYS.WEBSITE_LIST]
  return Array.isArray(value)
    ? (value as WebsiteItem[])
    : DEFAULT_VALUES.WEBSITE_LIST
}

export function getMatchingWebsite(
  currentUrl: string | undefined,
  websites: WebsiteItem[] | undefined
): WebsiteItem | null {
  if (!currentUrl || !websites) return null

  for (const website of websites) {
    try {
      const regex = new RegExp(website.regex, "i")
      if (regex.test(currentUrl.trim())) {
        return website
      }
    } catch {}
  }

  return null
}

export function getFontaraSiteActivationState(
  currentUrl: string,
  settings: Record<string, unknown>
): FontaraSiteActivationState {
  if (settings[STORAGE_KEYS.EXTENSION_ENABLED] === false) {
    return {
      active: false,
      matchingWebsite: null,
      siteProfile: null
    }
  }

  const websiteList = getWebsiteListFromSettings(settings)
  const matchingWebsite = getMatchingWebsite(currentUrl, websiteList)
  const enabledByDefault = normalizeEnabledByDefault(
    getSetting(
      settings,
      STORAGE_KEYS.ENABLED_BY_DEFAULT,
      DEFAULT_VALUES.ENABLED_BY_DEFAULT
    )
  )
  const enabledFor =
    settings[STORAGE_KEYS.ENABLED_FOR] === undefined
      ? getActiveWebsiteSitePatterns(websiteList)
      : normalizeEnabledSiteList(settings[STORAGE_KEYS.ENABLED_FOR])
  const disabledFor =
    settings[STORAGE_KEYS.DISABLED_FOR] === undefined
      ? DEFAULT_VALUES.DISABLED_FOR
      : normalizeSiteList(settings[STORAGE_KEYS.DISABLED_FOR])
  const active = isSiteListUrlEnabled(currentUrl, {
    disabledFor,
    enabledByDefault,
    enabledFor
  })

  return {
    active,
    matchingWebsite,
    siteProfile: active
      ? getSiteProfileForUrl(
          currentUrl,
          getSetting(
            settings,
            STORAGE_KEYS.SITE_PROFILES,
            DEFAULT_VALUES.SITE_PROFILES
          )
        )
      : null
  }
}

export function getFontaraRtlActivationState(
  currentUrl: string,
  settings: Record<string, unknown>
): FontaraRtlActivationState {
  const matchingSite = getRtlSiteByUrl(currentUrl)
  const siteSettings = normalizeRtlSiteSettings(
    settings[STORAGE_KEYS.RTL_SITE_SETTINGS]
  )
  const normalizedMasterEnabled =
    settings[STORAGE_KEYS.EXTENSION_ENABLED] !== false
  const normalizedGlobalEnabled = settings[STORAGE_KEYS.RTL_ENABLED] !== false
  const siteEnabled = matchingSite
    ? isRtlSiteEnabled(siteSettings, matchingSite.id)
    : false

  return {
    active:
      normalizedMasterEnabled &&
      normalizedGlobalEnabled &&
      siteEnabled &&
      matchingSite !== null,
    globalEnabled: normalizedGlobalEnabled,
    masterEnabled: normalizedMasterEnabled,
    matchingSite,
    siteEnabled,
    siteSettings
  }
}

export function resolveFontaraSiteConfig(
  currentUrl: string,
  settings: Record<string, unknown>
): FontaraResolvedSiteConfig {
  return {
    font: getFontaraSiteActivationState(currentUrl, settings),
    rtl: getFontaraRtlActivationState(currentUrl, settings)
  }
}
