import { normalizeUILanguagePreference } from "../config/i18n"
import {
  DEFAULT_RTL_SITE_SETTINGS,
  normalizeRtlSiteSettings,
  type RtlSiteSettings
} from "../config/rtl-sites"
import { normalizeTextStrokeValue } from "../config/text-stroke"
import type { FontData, WebsiteItem } from "../definitions"

export const EMPTY_CUSTOM_FONT_LIST: FontData[] = []
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

export function getRtlSiteSettingsInitialValue(
  value: unknown
): RtlSiteSettings {
  return value === undefined
    ? DEFAULT_RTL_SITE_SETTINGS
    : normalizeRtlSiteSettings(value)
}
