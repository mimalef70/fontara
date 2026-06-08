import {
  getActiveWebsiteSitePatterns,
  isSiteListUrlEnabled,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../config/site-list"
import { getSiteProfileForUrl } from "../config/site-profiles"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { SiteProfile, WebsiteItem } from "../definitions"
import { getLocalValue, getLocalValues } from "./storage"

export type UrlActivationState = {
  active: boolean
  matchingWebsite: WebsiteItem | null
  siteProfile: SiteProfile | null
}

function getSetting<T>(
  settings: Record<string, unknown>,
  key: string,
  fallback: T
): T {
  const value = settings[key]
  return value === undefined ? fallback : (value as T)
}

function getWebsiteListFromSettings(
  settings: Record<string, unknown>
): WebsiteItem[] {
  const value = settings[STORAGE_KEYS.WEBSITE_LIST]
  return Array.isArray(value)
    ? (value as WebsiteItem[])
    : DEFAULT_VALUES.WEBSITE_LIST
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function createRegexFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return `^https?://${escapeRegex(urlObj.hostname)}/?.*$`
  } catch {
    return url
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

export async function getStoredWebsiteList(): Promise<WebsiteItem[]> {
  try {
    const websiteList = await getLocalValue<WebsiteItem[]>(
      STORAGE_KEYS.WEBSITE_LIST
    )
    return Array.isArray(websiteList)
      ? websiteList
      : DEFAULT_VALUES.WEBSITE_LIST
  } catch {
    return DEFAULT_VALUES.WEBSITE_LIST
  }
}

export async function isUrlActive(currentUrl: string): Promise<boolean> {
  return (await getUrlActivationState(currentUrl)).active
}

export async function getUrlActivationState(
  currentUrl: string
): Promise<UrlActivationState> {
  let storedValues: Record<string, unknown> & {
    [STORAGE_KEYS.DISABLED_FOR]: string[] | undefined
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: boolean | undefined
    [STORAGE_KEYS.ENABLED_FOR]: string[] | undefined
    [STORAGE_KEYS.EXTENSION_ENABLED]: boolean
    [STORAGE_KEYS.SITE_PROFILES]: SiteProfile[] | undefined
    [STORAGE_KEYS.WEBSITE_LIST]: WebsiteItem[]
  }
  try {
    storedValues = await getLocalValues({
      [STORAGE_KEYS.DISABLED_FOR]: undefined,
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: undefined,
      [STORAGE_KEYS.ENABLED_FOR]: undefined,
      [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED,
      [STORAGE_KEYS.SITE_PROFILES]: DEFAULT_VALUES.SITE_PROFILES,
      [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
    })
  } catch {
    storedValues = {
      [STORAGE_KEYS.DISABLED_FOR]: undefined,
      [STORAGE_KEYS.ENABLED_BY_DEFAULT]: undefined,
      [STORAGE_KEYS.ENABLED_FOR]: undefined,
      [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED,
      [STORAGE_KEYS.SITE_PROFILES]: DEFAULT_VALUES.SITE_PROFILES,
      [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST
    }
  }

  return getUrlActivationStateFromSettings(currentUrl, storedValues)
}

export function getUrlActivationStateFromSettings(
  currentUrl: string,
  settings: Record<string, unknown>
): UrlActivationState {
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
