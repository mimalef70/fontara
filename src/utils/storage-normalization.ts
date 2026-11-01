import { DEFAULT_FONTS } from "../config/fonts"
import { normalizeUILanguagePreference } from "../config/i18n"
import { normalizeRtlSiteSettings } from "../config/rtl-sites"
import {
  createStoredSiteURL,
  getActiveWebsiteSitePatterns,
  getSitePatternScope,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../config/site-list"
import {
  hasSiteProfileOverrides,
  normalizeSiteProfiles
} from "../config/site-profiles"
import { normalizePinnedWebsiteUrls } from "../config/sites"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import {
  DEFAULT_ACTIVE_TEXT_STROKE,
  normalizeTextStrokeValue
} from "../config/text-stroke"
import type { CustomFontFamily } from "../custom-font-types"
import type { SiteProfile, WebsiteItem } from "../definitions"
import { normalizeCustomFontFamilies } from "./custom-font-normalization"
import {
  decodeGoogleFontValue,
  isSelectableGoogleFontFamily
} from "./google-font-runtime"
import { isSystemFontFeatureSupported, isSystemFontValue } from "./system-fonts"

const BUNDLED_FONT_VALUES = new Set(DEFAULT_FONTS.map((font) => font.value))

function shouldSyncDefaultSite(
  existingSite: WebsiteItem,
  defaultSite: WebsiteItem
): boolean {
  return (
    existingSite.regex !== defaultSite.regex ||
    existingSite.icon !== defaultSite.icon ||
    existingSite.pattern !== defaultSite.pattern ||
    existingSite.siteName !== defaultSite.siteName ||
    existingSite.customCss !== defaultSite.customCss
  )
}

export function mergeWebsiteLists(
  existingList: WebsiteItem[],
  defaultList: WebsiteItem[]
): WebsiteItem[] {
  const mergedList = [...existingList]

  for (const defaultSite of defaultList) {
    const existingIndex = mergedList.findIndex(
      (site) => site.url === defaultSite.url
    )

    if (existingIndex === -1) {
      mergedList.push(defaultSite)
      continue
    }

    if ("version" in defaultSite) {
      const existingSite = mergedList[existingIndex]

      if (
        !("version" in existingSite) ||
        existingSite.version !== defaultSite.version ||
        shouldSyncDefaultSite(existingSite, defaultSite)
      ) {
        mergedList[existingIndex] = {
          ...defaultSite,
          isActive: existingSite.isActive
        }
      }
      continue
    }

    const existingSite = mergedList[existingIndex]
    if (shouldSyncDefaultSite(existingSite, defaultSite)) {
      mergedList[existingIndex] = {
        ...defaultSite,
        isActive: existingSite.isActive
      }
    }
  }

  return mergedList
}

function createRegexFromUrl(url: string): string {
  try {
    const parsedURL = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`
    )
    const escapedHost = parsedURL.host
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return `^https?://${escapedHost}/?.*$`
  } catch {
    return url
  }
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function normalizeWebsiteItem(value: unknown): WebsiteItem | null {
  if (typeof value !== "object" || value === null) return null

  const website = value as Partial<WebsiteItem>
  const sourceURL = normalizeOptionalString(website.url)
  if (!sourceURL) return null

  const defaultWebsite = DEFAULT_VALUES.WEBSITE_LIST.find(
    (item) => item.url.replace(/\/+$/, "") === sourceURL.replace(/\/+$/, "")
  )
  const sourcePattern = normalizeOptionalString(website.pattern)
  const url =
    defaultWebsite?.url ??
    createStoredSiteURL(
      sourceURL,
      sourcePattern && getSitePatternScope(sourcePattern) === "path"
        ? "path"
        : "domain"
    )
  if (!url) return null

  const regex = defaultWebsite?.regex ?? createRegexFromUrl(url)
  try {
    new RegExp(regex)
  } catch {
    return null
  }

  return {
    url,
    regex,
    ...(website.isActive === false ? { isActive: false } : { isActive: true }),
    ...(normalizeOptionalString(website.icon)
      ? { icon: normalizeOptionalString(website.icon) }
      : {}),
    ...(sourcePattern ? { pattern: sourcePattern } : {}),
    ...(normalizeOptionalString(website.siteName)
      ? { siteName: normalizeOptionalString(website.siteName) }
      : {}),
    ...(normalizeOptionalString(website.version)
      ? { version: normalizeOptionalString(website.version) }
      : {}),
    ...(typeof website.customCss === "boolean"
      ? { customCss: website.customCss }
      : {})
  }
}

export function normalizeWebsiteListForStorage(value: unknown): WebsiteItem[] {
  if (!Array.isArray(value)) {
    return DEFAULT_VALUES.WEBSITE_LIST
  }

  const normalizedSites: WebsiteItem[] = []
  const siteIndexes = new Map<string, number>()

  for (const item of value) {
    const normalizedSite = normalizeWebsiteItem(item)
    if (!normalizedSite) continue

    const existingIndex = siteIndexes.get(normalizedSite.url)
    if (existingIndex === undefined) {
      siteIndexes.set(normalizedSite.url, normalizedSites.length)
      normalizedSites.push(normalizedSite)
      continue
    }

    normalizedSites[existingIndex] = normalizedSite
  }

  return mergeWebsiteLists(normalizedSites, DEFAULT_VALUES.WEBSITE_LIST)
}

export async function normalizeCustomFontList(
  customFontList: unknown
): Promise<CustomFontFamily[]> {
  return normalizeCustomFontFamilies(customFontList)
}

export function isSelectedFontAvailable(
  selectedFont: string | undefined,
  customFontList: CustomFontFamily[],
  googleFontsEnabled: boolean,
  _systemFontsEnabled: boolean
): boolean {
  return (
    selectedFont === undefined ||
    BUNDLED_FONT_VALUES.has(selectedFont) ||
    customFontList.some((font) => font.value === selectedFont) ||
    (googleFontsEnabled &&
      isSelectableGoogleFontFamily(decodeGoogleFontValue(selectedFont))) ||
    isSystemFontValue(selectedFont)
  )
}

export function normalizeSiteProfilesForStorage(
  siteProfiles: unknown,
  customFontList: CustomFontFamily[],
  googleFontsEnabled: boolean,
  systemFontsEnabled: boolean
): SiteProfile[] {
  return normalizeSiteProfiles(siteProfiles)
    .map((profile) => {
      if (
        !profile.font ||
        isSelectedFontAvailable(
          profile.font,
          customFontList,
          googleFontsEnabled,
          systemFontsEnabled
        )
      ) {
        return profile
      }

      const { font: _unavailableFont, ...profileWithoutFont } = profile
      return profileWithoutFont
    })
    .filter(hasSiteProfileOverrides)
}

export async function normalizeStorageValues(
  values: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const googleFontsEnabled =
    typeof values[STORAGE_KEYS.GOOGLE_FONTS_ENABLED] === "boolean"
      ? (values[STORAGE_KEYS.GOOGLE_FONTS_ENABLED] as boolean)
      : DEFAULT_VALUES.GOOGLE_FONTS_ENABLED
  const systemFontsSupported = isSystemFontFeatureSupported()
  const systemFontsEnabled =
    systemFontsSupported &&
    (typeof values[STORAGE_KEYS.SYSTEM_FONTS_ENABLED] === "boolean"
      ? (values[STORAGE_KEYS.SYSTEM_FONTS_ENABLED] as boolean)
      : DEFAULT_VALUES.SYSTEM_FONTS_ENABLED)
  const websiteList = normalizeWebsiteListForStorage(
    values[STORAGE_KEYS.WEBSITE_LIST]
  )
  const customFontList = await normalizeCustomFontList(
    values[STORAGE_KEYS.CUSTOM_FONT_LIST]
  )
  const selectedFont =
    typeof values[STORAGE_KEYS.SELECTED_FONT] === "string"
      ? (values[STORAGE_KEYS.SELECTED_FONT] as string)
      : DEFAULT_VALUES.SELECTED_FONT
  const normalizedTextStroke =
    values[STORAGE_KEYS.TEXT_STROKE] === undefined &&
    typeof values[STORAGE_KEYS.TEXT_STROKE_ENABLED] === "boolean"
      ? values[STORAGE_KEYS.TEXT_STROKE_ENABLED]
        ? DEFAULT_ACTIVE_TEXT_STROKE
        : DEFAULT_VALUES.TEXT_STROKE
      : normalizeTextStrokeValue(values[STORAGE_KEYS.TEXT_STROKE])

  return {
    [STORAGE_KEYS.EXTENSION_ENABLED]:
      values[STORAGE_KEYS.EXTENSION_ENABLED] !== false,
    [STORAGE_KEYS.SELECTED_FONT]: isSelectedFontAvailable(
      selectedFont,
      customFontList,
      googleFontsEnabled,
      systemFontsEnabled
    )
      ? selectedFont
      : DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: websiteList,
    [STORAGE_KEYS.PINNED_WEBSITE_URLS]:
      values[STORAGE_KEYS.PINNED_WEBSITE_URLS] === undefined
        ? DEFAULT_VALUES.PINNED_WEBSITE_URLS
        : normalizePinnedWebsiteUrls(values[STORAGE_KEYS.PINNED_WEBSITE_URLS]),
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: normalizeEnabledByDefault(
      values[STORAGE_KEYS.ENABLED_BY_DEFAULT]
    ),
    [STORAGE_KEYS.ENABLED_FOR]:
      values[STORAGE_KEYS.ENABLED_FOR] === undefined
        ? getActiveWebsiteSitePatterns(websiteList)
        : normalizeEnabledSiteList(values[STORAGE_KEYS.ENABLED_FOR]),
    [STORAGE_KEYS.DISABLED_FOR]:
      values[STORAGE_KEYS.DISABLED_FOR] === undefined
        ? DEFAULT_VALUES.DISABLED_FOR
        : normalizeSiteList(values[STORAGE_KEYS.DISABLED_FOR]),
    [STORAGE_KEYS.SITE_PROFILES]: normalizeSiteProfilesForStorage(
      values[STORAGE_KEYS.SITE_PROFILES],
      customFontList,
      googleFontsEnabled,
      systemFontsEnabled
    ),
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: customFontList,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: googleFontsEnabled,
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: systemFontsEnabled,
    [STORAGE_KEYS.TEXT_STROKE]: normalizedTextStroke,
    [STORAGE_KEYS.UI_LANGUAGE]: normalizeUILanguagePreference(
      values[STORAGE_KEYS.UI_LANGUAGE]
    ),
    [STORAGE_KEYS.RTL_ENABLED]: values[STORAGE_KEYS.RTL_ENABLED] !== false,
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: normalizeRtlSiteSettings(
      values[STORAGE_KEYS.RTL_SITE_SETTINGS]
    ),
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]:
      values[STORAGE_KEYS.CONTEXT_MENUS_ENABLED] === true,
    [STORAGE_KEYS.SYNC_SETTINGS]: values[STORAGE_KEYS.SYNC_SETTINGS] !== false
  }
}
