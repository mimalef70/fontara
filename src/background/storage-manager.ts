import { DEFAULT_FONTS } from "../config/fonts"
import { normalizeUILanguagePreference } from "../config/i18n"
import { normalizeRtlSiteSettings } from "../config/rtl-sites"
import {
  getActiveWebsiteSitePatterns,
  normalizeEnabledByDefault,
  normalizeSiteList
} from "../config/site-list"
import {
  hasSiteProfileOverrides,
  normalizeSiteProfiles
} from "../config/site-profiles"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import {
  DEFAULT_ACTIVE_TEXT_STROKE,
  normalizeTextStrokeValue
} from "../config/text-stroke"
import type { FontData, SiteProfile, WebsiteItem } from "../definitions"
import {
  getFontDataURLFormat,
  isSafeCustomFontValue,
  isSupportedFontExtension,
  normalizeFontDataURL
} from "../utils/font-data"
import { getGoogleFontByValue } from "../utils/google-fonts"
import { getLocalValue, setLocalValue } from "../utils/storage"
import { isSystemFontValue } from "../utils/system-fonts"

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

function dataURLToBytes(dataURL: string): Uint8Array {
  const [, base64Data] = dataURL.split(",", 2)
  if (!base64Data) {
    return new TextEncoder().encode(dataURL)
  }

  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function createSHA256Hash(data: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(buffer).set(data)

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function normalizeCustomFontList(
  customFontList: unknown
): Promise<FontData[]> {
  if (!Array.isArray(customFontList)) {
    return DEFAULT_VALUES.CUSTOM_FONT_LIST
  }

  const normalizedFonts = await Promise.all(
    customFontList.map(async (font) => {
      const customFont = font as Partial<FontData>
      const value = customFont.value
      const name =
        typeof customFont.name === "string" ? customFont.name.trim() : ""
      const data = typeof customFont.data === "string" ? customFont.data : ""
      const type =
        typeof customFont.type === "string" ? customFont.type.toLowerCase() : ""
      const normalizedData = normalizeFontDataURL(data, type)

      if (
        !isSafeCustomFontValue(value) ||
        !name ||
        !normalizedData ||
        !getFontDataURLFormat(normalizedData, type) ||
        !isSupportedFontExtension(type)
      ) {
        return null
      }

      const fileHash =
        typeof customFont.fileHash === "string" &&
        /^[a-f0-9]{64}$/i.test(customFont.fileHash)
          ? customFont.fileHash
          : await createSHA256Hash(dataURLToBytes(data))
      const originalFileName =
        typeof customFont.originalFileName === "string" &&
        customFont.originalFileName.trim()
          ? customFont.originalFileName.trim()
          : name

      return {
        value,
        name,
        data: normalizedData,
        type,
        fileHash,
        originalFileName
      }
    })
  )

  return normalizedFonts.filter((font): font is FontData => font !== null)
}

function isSelectedFontAvailable(
  selectedFont: string | undefined,
  customFontList: FontData[],
  googleFontsEnabled: boolean,
  systemFontsEnabled: boolean
): boolean {
  return (
    selectedFont === undefined ||
    BUNDLED_FONT_VALUES.has(selectedFont) ||
    customFontList.some((font) => font.value === selectedFont) ||
    (googleFontsEnabled && getGoogleFontByValue(selectedFont) !== null) ||
    (systemFontsEnabled && isSystemFontValue(selectedFont))
  )
}

function normalizeSiteProfilesForStorage(
  siteProfiles: unknown,
  customFontList: FontData[],
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

  const websiteList = await getLocalValue<WebsiteItem[]>(
    STORAGE_KEYS.WEBSITE_LIST
  )
  let normalizedWebsiteList: WebsiteItem[]
  if (websiteList === undefined) {
    normalizedWebsiteList = DEFAULT_VALUES.WEBSITE_LIST
  } else {
    normalizedWebsiteList = mergeWebsiteLists(
      websiteList,
      DEFAULT_VALUES.WEBSITE_LIST
    )
  }
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
      : normalizeSiteList(enabledFor)
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
