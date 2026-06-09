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
import { getSiteProfileForUrl, normalizeSiteProfiles } from "./site-profiles"
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

export type FontaraSiteManagerSettingsSnapshot = {
  disabledFor: string[]
  enabledByDefault: boolean
  enabledFor: string[]
  extensionEnabled: boolean
  rtlEnabled: boolean
  rtlSiteSettings: RtlSiteSettings
  siteProfiles: SiteProfile[]
  websiteList: WebsiteItem[]
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

export function normalizeFontaraSiteManagerSettings(
  settings: Record<string, unknown>
): FontaraSiteManagerSettingsSnapshot {
  const websiteList = getWebsiteListFromSettings(settings)
  const enabledByDefault = normalizeEnabledByDefault(
    getSetting(
      settings,
      STORAGE_KEYS.ENABLED_BY_DEFAULT,
      DEFAULT_VALUES.ENABLED_BY_DEFAULT
    )
  )

  return {
    disabledFor:
      settings[STORAGE_KEYS.DISABLED_FOR] === undefined
        ? DEFAULT_VALUES.DISABLED_FOR
        : normalizeSiteList(settings[STORAGE_KEYS.DISABLED_FOR]),
    enabledByDefault,
    enabledFor:
      settings[STORAGE_KEYS.ENABLED_FOR] === undefined
        ? getActiveWebsiteSitePatterns(websiteList)
        : normalizeEnabledSiteList(settings[STORAGE_KEYS.ENABLED_FOR]),
    extensionEnabled: settings[STORAGE_KEYS.EXTENSION_ENABLED] !== false,
    rtlEnabled: settings[STORAGE_KEYS.RTL_ENABLED] !== false,
    rtlSiteSettings: normalizeRtlSiteSettings(
      settings[STORAGE_KEYS.RTL_SITE_SETTINGS]
    ),
    siteProfiles: normalizeSiteProfiles(
      getSetting(
        settings,
        STORAGE_KEYS.SITE_PROFILES,
        DEFAULT_VALUES.SITE_PROFILES
      )
    ),
    websiteList
  }
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

function getFontaraSiteActivationStateFromSnapshot(
  currentUrl: string,
  snapshot: FontaraSiteManagerSettingsSnapshot
): FontaraSiteActivationState {
  if (!snapshot.extensionEnabled) {
    return {
      active: false,
      matchingWebsite: null,
      siteProfile: null
    }
  }

  const matchingWebsite = getMatchingWebsite(currentUrl, snapshot.websiteList)
  const active = isSiteListUrlEnabled(currentUrl, {
    disabledFor: snapshot.disabledFor,
    enabledByDefault: snapshot.enabledByDefault,
    enabledFor: snapshot.enabledFor
  })

  return {
    active,
    matchingWebsite,
    siteProfile: active
      ? getSiteProfileForUrl(currentUrl, snapshot.siteProfiles)
      : null
  }
}

export function getFontaraSiteActivationState(
  currentUrl: string,
  settings: Record<string, unknown>
): FontaraSiteActivationState {
  return getFontaraSiteActivationStateFromSnapshot(
    currentUrl,
    normalizeFontaraSiteManagerSettings(settings)
  )
}

function getFontaraRtlActivationStateFromSnapshot(
  currentUrl: string,
  snapshot: FontaraSiteManagerSettingsSnapshot
): FontaraRtlActivationState {
  const matchingSite = getRtlSiteByUrl(currentUrl)
  const siteEnabled = matchingSite
    ? isRtlSiteEnabled(snapshot.rtlSiteSettings, matchingSite.id)
    : false

  return {
    active:
      snapshot.extensionEnabled &&
      snapshot.rtlEnabled &&
      siteEnabled &&
      matchingSite !== null,
    globalEnabled: snapshot.rtlEnabled,
    masterEnabled: snapshot.extensionEnabled,
    matchingSite,
    siteEnabled,
    siteSettings: snapshot.rtlSiteSettings
  }
}

export function getFontaraRtlActivationState(
  currentUrl: string,
  settings: Record<string, unknown>
): FontaraRtlActivationState {
  return getFontaraRtlActivationStateFromSnapshot(
    currentUrl,
    normalizeFontaraSiteManagerSettings(settings)
  )
}

export function resolveFontaraSiteConfig(
  currentUrl: string,
  settings: Record<string, unknown>
): FontaraResolvedSiteConfig {
  const snapshot = normalizeFontaraSiteManagerSettings(settings)

  return {
    font: getFontaraSiteActivationStateFromSnapshot(currentUrl, snapshot),
    rtl: getFontaraRtlActivationStateFromSnapshot(currentUrl, snapshot)
  }
}
