import {
  type FontaraSiteActivationState,
  getFontaraSiteActivationState
} from "../config/site-manager"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { SiteProfile, WebsiteItem } from "../definitions"
import { getLocalValue, getLocalValues } from "./storage"

export { getMatchingWebsite } from "../config/site-manager"

export type UrlActivationState = FontaraSiteActivationState

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
  return getFontaraSiteActivationState(currentUrl, settings)
}
