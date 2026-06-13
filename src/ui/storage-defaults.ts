import { normalizeUILanguagePreference } from "../config/i18n"
import {
  DEFAULT_RTL_SITE_SETTINGS,
  normalizeRtlSiteSettings,
  type RtlSiteSettings
} from "../config/rtl-sites"
import {
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../config/site-list"
import {
  EMPTY_SITE_PROFILES,
  normalizeSiteProfiles
} from "../config/site-profiles"
import { normalizePinnedWebsiteUrls } from "../config/sites"
import { DEFAULT_VALUES } from "../config/storage"
import { normalizeTextStrokeValue } from "../config/text-stroke"
import type { FontData, SiteProfile, WebsiteItem } from "../definitions"

export const EMPTY_CUSTOM_FONT_LIST: FontData[] = []
export const EMPTY_SITE_PROFILE_LIST: SiteProfile[] = EMPTY_SITE_PROFILES
export const EMPTY_WEBSITE_LIST: WebsiteItem[] = []

export function getExtensionEnabledInitialValue(
  value: boolean | undefined
): boolean {
  return value !== false
}

export function getUILanguagePreferenceInitialValue(value: unknown) {
  return normalizeUILanguagePreference(value)
}

export function getRtlEnabledInitialValue(value: boolean | undefined): boolean {
  return value !== false
}

export function getSyncSettingsInitialValue(
  value: boolean | undefined
): boolean {
  return value !== false
}

export function getContextMenusEnabledInitialValue(
  value: boolean | undefined
): boolean {
  return value === true
}

export function getSystemFontsEnabledInitialValue(
  value: boolean | undefined
): boolean {
  return value === true
}

export function getGoogleFontsEnabledInitialValue(
  value: boolean | undefined
): boolean {
  return value === true
}

export function getTextStrokeInitialValue(value: unknown): number {
  return normalizeTextStrokeValue(value)
}

export function getEnabledByDefaultInitialValue(value: unknown): boolean {
  return normalizeEnabledByDefault(value)
}

export function getEnabledForInitialValue(value: unknown): string[] {
  return value === undefined
    ? DEFAULT_VALUES.ENABLED_FOR
    : normalizeEnabledSiteList(value)
}

export function getDisabledForInitialValue(value: unknown): string[] {
  return value === undefined
    ? DEFAULT_VALUES.DISABLED_FOR
    : normalizeSiteList(value)
}

export function getPinnedWebsiteUrlsInitialValue(value: unknown): string[] {
  return value === undefined
    ? DEFAULT_VALUES.PINNED_WEBSITE_URLS
    : normalizePinnedWebsiteUrls(value)
}

export function getSiteProfilesInitialValue(value: unknown): SiteProfile[] {
  return normalizeSiteProfiles(value)
}

export function getRtlSiteSettingsInitialValue(
  value: unknown
): RtlSiteSettings {
  return value === undefined
    ? DEFAULT_RTL_SITE_SETTINGS
    : normalizeRtlSiteSettings(value)
}
