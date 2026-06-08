import { normalizeUILanguagePreference } from "../config/i18n"
import { normalizeRtlSiteSettings } from "../config/rtl-sites"
import {
  getActiveWebsiteSitePatterns,
  normalizeEnabledByDefault,
  normalizeEnabledSiteList,
  normalizeSiteList
} from "../config/site-list"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import {
  DEFAULT_ACTIVE_TEXT_STROKE,
  normalizeTextStrokeValue
} from "../config/text-stroke"
import type { FontData } from "../definitions"
import { getLocalValue, setLocalValue } from "../utils/storage"
import {
  isSelectedFontAvailable,
  mergeWebsiteLists,
  normalizeCustomFontList,
  normalizeSiteProfilesForStorage,
  normalizeWebsiteListForStorage
} from "../utils/storage-normalization"

export { mergeWebsiteLists, normalizeCustomFontList }

export async function ensureStorageValues(): Promise<void> {
  const storageUpdates: Record<string, unknown> = {}

  const extensionEnabled = await getLocalValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED
  )
  if (extensionEnabled === undefined) {
    storageUpdates[STORAGE_KEYS.EXTENSION_ENABLED] =
      DEFAULT_VALUES.EXTENSION_ENABLED
  }

  const rtlEnabled = await getLocalValue<boolean>(STORAGE_KEYS.RTL_ENABLED)
  if (rtlEnabled === undefined) {
    storageUpdates[STORAGE_KEYS.RTL_ENABLED] = DEFAULT_VALUES.RTL_ENABLED
  }

  const systemFontsEnabled = await getLocalValue<boolean>(
    STORAGE_KEYS.SYSTEM_FONTS_ENABLED
  )
  if (typeof systemFontsEnabled !== "boolean") {
    storageUpdates[STORAGE_KEYS.SYSTEM_FONTS_ENABLED] =
      DEFAULT_VALUES.SYSTEM_FONTS_ENABLED
  }

  const googleFontsEnabled = await getLocalValue<boolean>(
    STORAGE_KEYS.GOOGLE_FONTS_ENABLED
  )
  if (typeof googleFontsEnabled !== "boolean") {
    storageUpdates[STORAGE_KEYS.GOOGLE_FONTS_ENABLED] =
      DEFAULT_VALUES.GOOGLE_FONTS_ENABLED
  }

  const textStroke = await getLocalValue<number>(STORAGE_KEYS.TEXT_STROKE)
  const legacyTextStrokeEnabled = await getLocalValue<boolean>(
    STORAGE_KEYS.TEXT_STROKE_ENABLED
  )
  const normalizedTextStroke =
    textStroke === undefined && typeof legacyTextStrokeEnabled === "boolean"
      ? legacyTextStrokeEnabled
        ? DEFAULT_ACTIVE_TEXT_STROKE
        : DEFAULT_VALUES.TEXT_STROKE
      : normalizeTextStrokeValue(textStroke)
  if (textStroke !== normalizedTextStroke) {
    storageUpdates[STORAGE_KEYS.TEXT_STROKE] = normalizedTextStroke
  }

  const rtlSiteSettings = await getLocalValue(STORAGE_KEYS.RTL_SITE_SETTINGS)
  const normalizedRtlSiteSettings = normalizeRtlSiteSettings(rtlSiteSettings)
  if (
    JSON.stringify(rtlSiteSettings) !==
    JSON.stringify(normalizedRtlSiteSettings)
  ) {
    storageUpdates[STORAGE_KEYS.RTL_SITE_SETTINGS] = normalizedRtlSiteSettings
  }

  const uiLanguage = await getLocalValue(STORAGE_KEYS.UI_LANGUAGE)
  const normalizedUILanguage = normalizeUILanguagePreference(uiLanguage)
  if (uiLanguage !== normalizedUILanguage) {
    storageUpdates[STORAGE_KEYS.UI_LANGUAGE] = normalizedUILanguage
  }

  const selectedFont = await getLocalValue<string>(STORAGE_KEYS.SELECTED_FONT)
  if (selectedFont === undefined) {
    storageUpdates[STORAGE_KEYS.SELECTED_FONT] = DEFAULT_VALUES.SELECTED_FONT
  }

  const websiteList = await getLocalValue(STORAGE_KEYS.WEBSITE_LIST)
  const normalizedWebsiteList =
    websiteList === undefined
      ? DEFAULT_VALUES.WEBSITE_LIST
      : normalizeWebsiteListForStorage(websiteList)
  storageUpdates[STORAGE_KEYS.WEBSITE_LIST] = normalizedWebsiteList

  const enabledByDefault = await getLocalValue<boolean>(
    STORAGE_KEYS.ENABLED_BY_DEFAULT
  )
  const normalizedEnabledByDefault =
    typeof enabledByDefault === "boolean"
      ? normalizeEnabledByDefault(enabledByDefault)
      : DEFAULT_VALUES.ENABLED_BY_DEFAULT
  if (enabledByDefault !== normalizedEnabledByDefault) {
    storageUpdates[STORAGE_KEYS.ENABLED_BY_DEFAULT] = normalizedEnabledByDefault
  }

  const enabledFor = await getLocalValue(STORAGE_KEYS.ENABLED_FOR)
  const normalizedEnabledFor =
    enabledFor === undefined
      ? getActiveWebsiteSitePatterns(normalizedWebsiteList)
      : normalizeEnabledSiteList(enabledFor)
  if (JSON.stringify(enabledFor) !== JSON.stringify(normalizedEnabledFor)) {
    storageUpdates[STORAGE_KEYS.ENABLED_FOR] = normalizedEnabledFor
  }

  const disabledFor = await getLocalValue(STORAGE_KEYS.DISABLED_FOR)
  const normalizedDisabledFor =
    disabledFor === undefined
      ? DEFAULT_VALUES.DISABLED_FOR
      : normalizeSiteList(disabledFor)
  if (JSON.stringify(disabledFor) !== JSON.stringify(normalizedDisabledFor)) {
    storageUpdates[STORAGE_KEYS.DISABLED_FOR] = normalizedDisabledFor
  }

  const customFontList = await getLocalValue(STORAGE_KEYS.CUSTOM_FONT_LIST)
  let normalizedCustomFontList: FontData[]
  if (customFontList === undefined) {
    normalizedCustomFontList = DEFAULT_VALUES.CUSTOM_FONT_LIST
  } else {
    normalizedCustomFontList = await normalizeCustomFontList(customFontList)
  }
  storageUpdates[STORAGE_KEYS.CUSTOM_FONT_LIST] = normalizedCustomFontList

  const siteProfiles = await getLocalValue(STORAGE_KEYS.SITE_PROFILES)
  const normalizedSiteProfiles = normalizeSiteProfilesForStorage(
    siteProfiles,
    normalizedCustomFontList,
    googleFontsEnabled === true,
    systemFontsEnabled === true
  )
  if (JSON.stringify(siteProfiles) !== JSON.stringify(normalizedSiteProfiles)) {
    storageUpdates[STORAGE_KEYS.SITE_PROFILES] = normalizedSiteProfiles
  }

  if (
    !isSelectedFontAvailable(
      selectedFont,
      normalizedCustomFontList,
      googleFontsEnabled === true,
      systemFontsEnabled === true
    )
  ) {
    storageUpdates[STORAGE_KEYS.SELECTED_FONT] = DEFAULT_VALUES.SELECTED_FONT
  }

  await Promise.all(
    Object.entries(storageUpdates).map(([key, value]) =>
      setLocalValue(key, value)
    )
  )
}
