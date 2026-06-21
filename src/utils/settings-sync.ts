import {
  hasSiteProfileOverrides,
  normalizeSiteProfiles
} from "../config/site-profiles"
import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type { FontData, SiteProfile } from "../definitions"
import {
  normalizeCustomFontList,
  normalizeStorageValues
} from "./storage-normalization"
import { isSystemFontValue } from "./system-fonts"

export const FONTARA_SYNCED_STORAGE_KEYS = [
  STORAGE_KEYS.EXTENSION_ENABLED,
  STORAGE_KEYS.SELECTED_FONT,
  STORAGE_KEYS.WEBSITE_LIST,
  STORAGE_KEYS.PINNED_WEBSITE_URLS,
  STORAGE_KEYS.ENABLED_BY_DEFAULT,
  STORAGE_KEYS.ENABLED_FOR,
  STORAGE_KEYS.DISABLED_FOR,
  STORAGE_KEYS.SITE_PROFILES,
  STORAGE_KEYS.GOOGLE_FONTS_ENABLED,
  STORAGE_KEYS.TEXT_STROKE,
  STORAGE_KEYS.UI_LANGUAGE,
  STORAGE_KEYS.RTL_ENABLED,
  STORAGE_KEYS.RTL_SITE_SETTINGS,
  STORAGE_KEYS.CONTEXT_MENUS_ENABLED,
  STORAGE_KEYS.SYNC_SETTINGS
] as const

export const FONTARA_SYNC_LOCAL_ONLY_STORAGE_KEYS = [
  STORAGE_KEYS.CUSTOM_FONT_LIST
] as const

export const FONTARA_SYNC_STORAGE_CHUNK_META_KEY = "__meta_split_count"
export const FONTARA_SETTINGS_UPDATED_AT_KEY = "__fontara_settings_updated_at__"

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.getOwnPropertyDescriptor(value, key) !== undefined
}

function isSyncedStorageKey(key: string): boolean {
  return (FONTARA_SYNCED_STORAGE_KEYS as readonly string[]).includes(key)
}

export function getSettingsUpdatedAt(values: Record<string, unknown>): number {
  const value = values[FONTARA_SETTINGS_UPDATED_AT_KEY]

  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0
}

export function createSettingsUpdatedAtPatch(
  updatedAt = Date.now()
): Record<string, number> {
  return {
    [FONTARA_SETTINGS_UPDATED_AT_KEY]: updatedAt
  }
}

function getCustomFontValueSet(customFontList: FontData[]): Set<string> {
  return new Set(customFontList.map((font) => font.value))
}

function stripLocalOnlySiteProfileOverrides(
  siteProfiles: unknown,
  isLocalOnlyFont: (font: string) => boolean
): SiteProfile[] {
  return normalizeSiteProfiles(siteProfiles)
    .map((profile) => {
      if (!profile.font || !isLocalOnlyFont(profile.font)) {
        return profile
      }

      const { font: _localOnlyFont, ...profileWithoutFont } = profile
      return profileWithoutFont
    })
    .filter(hasSiteProfileOverrides)
}

function mergeLocalOnlySiteProfileOverrides(
  syncedProfiles: SiteProfile[],
  localProfiles: SiteProfile[],
  isLocalOnlyFont: (font: string) => boolean
): SiteProfile[] {
  const profilesByPattern = new Map(
    syncedProfiles.map((profile) => [profile.pattern, profile])
  )

  for (const localProfile of localProfiles) {
    if (!localProfile.font || !isLocalOnlyFont(localProfile.font)) {
      continue
    }

    const mergedProfile = {
      ...localProfile,
      ...profilesByPattern.get(localProfile.pattern),
      font: localProfile.font
    }
    if (localProfile.enabled === false) {
      mergedProfile.enabled = false
    }

    profilesByPattern.set(localProfile.pattern, mergedProfile)
  }

  return Array.from(profilesByPattern.values()).filter(hasSiteProfileOverrides)
}

export function getSettingsSyncDefaults(): Record<string, unknown> {
  return {
    [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.PINNED_WEBSITE_URLS]: DEFAULT_VALUES.PINNED_WEBSITE_URLS,
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: DEFAULT_VALUES.ENABLED_BY_DEFAULT,
    [STORAGE_KEYS.ENABLED_FOR]: DEFAULT_VALUES.ENABLED_FOR,
    [STORAGE_KEYS.DISABLED_FOR]: DEFAULT_VALUES.DISABLED_FOR,
    [STORAGE_KEYS.SITE_PROFILES]: DEFAULT_VALUES.SITE_PROFILES,
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: DEFAULT_VALUES.GOOGLE_FONTS_ENABLED,
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: DEFAULT_VALUES.SYSTEM_FONTS_ENABLED,
    [STORAGE_KEYS.TEXT_STROKE]: DEFAULT_VALUES.TEXT_STROKE,
    [STORAGE_KEYS.UI_LANGUAGE]: DEFAULT_VALUES.UI_LANGUAGE,
    [STORAGE_KEYS.RTL_ENABLED]: DEFAULT_VALUES.RTL_ENABLED,
    [STORAGE_KEYS.RTL_SITE_SETTINGS]: DEFAULT_VALUES.RTL_SITE_SETTINGS,
    [STORAGE_KEYS.CONTEXT_MENUS_ENABLED]: DEFAULT_VALUES.CONTEXT_MENUS_ENABLED,
    [STORAGE_KEYS.SYNC_SETTINGS]: DEFAULT_VALUES.SYNC_SETTINGS
  }
}

export function getSettingsSyncReadDefaults(): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      FONTARA_SYNCED_STORAGE_KEYS.map((key) => [key, undefined])
    ),
    [FONTARA_SETTINGS_UPDATED_AT_KEY]: undefined
  }
}

export function getLocalStorageReadDefaults(): Record<string, unknown> {
  return {
    ...getSettingsSyncReadDefaults(),
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: undefined,
    [STORAGE_KEYS.TEXT_STROKE_ENABLED]: undefined
  }
}

export function pickSyncedSettings(
  values: Record<string, unknown>
): Record<string, unknown> {
  const defaults = getSettingsSyncDefaults()
  const syncedSettings: Record<string, unknown> = {}

  for (const key of FONTARA_SYNCED_STORAGE_KEYS) {
    syncedSettings[key] = hasOwn(values, key) ? values[key] : defaults[key]
  }

  return syncedSettings
}

export function hasSyncedSettingsValues(
  values: Record<string, unknown>
): boolean {
  return FONTARA_SYNCED_STORAGE_KEYS.some(
    (key) => key !== STORAGE_KEYS.SYNC_SETTINGS && values[key] !== undefined
  )
}

export async function createSyncedSettings(
  values: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const customFontList = await normalizeCustomFontList(
    values[STORAGE_KEYS.CUSTOM_FONT_LIST]
  )
  const customFontValues = getCustomFontValueSet(customFontList)
  const selectedFontIsLocalOnly =
    typeof values[STORAGE_KEYS.SELECTED_FONT] === "string" &&
    (customFontValues.has(values[STORAGE_KEYS.SELECTED_FONT] as string) ||
      isSystemFontValue(values[STORAGE_KEYS.SELECTED_FONT]))
  const syncInput: Record<string, unknown> = {
    ...getSettingsSyncDefaults(),
    ...pickSyncedSettings(values),
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: DEFAULT_VALUES.CUSTOM_FONT_LIST
  }

  if (selectedFontIsLocalOnly) {
    syncInput[STORAGE_KEYS.SELECTED_FONT] = DEFAULT_VALUES.SELECTED_FONT
  }

  syncInput[STORAGE_KEYS.SITE_PROFILES] = stripLocalOnlySiteProfileOverrides(
    syncInput[STORAGE_KEYS.SITE_PROFILES],
    (font) => customFontValues.has(font) || isSystemFontValue(font)
  )

  const syncedSettings = pickSyncedSettings(
    await normalizeStorageValues(syncInput)
  )
  const updatedAt = getSettingsUpdatedAt(values)
  if (selectedFontIsLocalOnly) {
    delete syncedSettings[STORAGE_KEYS.SELECTED_FONT]
  }
  if (updatedAt > 0) {
    syncedSettings[FONTARA_SETTINGS_UPDATED_AT_KEY] = updatedAt
  }

  return syncedSettings
}

export async function mergeSyncedSettingsWithLocalOnlyValues(
  localValues: Record<string, unknown>,
  syncedValues: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const normalizedCustomFontList = await normalizeCustomFontList(
    localValues[STORAGE_KEYS.CUSTOM_FONT_LIST]
  )
  const customFontValues = getCustomFontValueSet(normalizedCustomFontList)
  const normalizedSyncedValues = await normalizeStorageValues({
    ...getSettingsSyncDefaults(),
    ...Object.fromEntries(
      Object.entries(syncedValues).filter(([key]) => isSyncedStorageKey(key))
    ),
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: normalizedCustomFontList
  })
  const normalizedLocalValues = await normalizeStorageValues({
    ...getSettingsSyncDefaults(),
    ...localValues,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: normalizedCustomFontList
  })
  const localSelectedFont = normalizedLocalValues[
    STORAGE_KEYS.SELECTED_FONT
  ] as string
  const localSystemFontsEnabled =
    normalizedLocalValues[STORAGE_KEYS.SYSTEM_FONTS_ENABLED] === true
  const isLocalOnlyFont = (font: string): boolean =>
    customFontValues.has(font) ||
    (localSystemFontsEnabled && isSystemFontValue(font))
  const mergedValues: Record<string, unknown> = {
    ...normalizedSyncedValues,
    [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: localSystemFontsEnabled,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: normalizedCustomFontList
  }

  if (isLocalOnlyFont(localSelectedFont)) {
    mergedValues[STORAGE_KEYS.SELECTED_FONT] = localSelectedFont
  }

  mergedValues[STORAGE_KEYS.SITE_PROFILES] = mergeLocalOnlySiteProfileOverrides(
    normalizedSyncedValues[STORAGE_KEYS.SITE_PROFILES] as SiteProfile[],
    normalizedLocalValues[STORAGE_KEYS.SITE_PROFILES] as SiteProfile[],
    isLocalOnlyFont
  )
  const updatedAt = Math.max(
    getSettingsUpdatedAt(localValues),
    getSettingsUpdatedAt(syncedValues)
  )
  if (updatedAt > 0) {
    mergedValues[FONTARA_SETTINGS_UPDATED_AT_KEY] = updatedAt
  }

  return mergedValues
}
