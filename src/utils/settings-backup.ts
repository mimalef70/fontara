import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import { normalizeStorageValues } from "./storage-normalization"

export const FONTARA_SETTINGS_EXPORT_FORMAT = "fontara-settings"
export const FONTARA_SETTINGS_EXPORT_VERSION = 1

export const FONTARA_SETTINGS_STORAGE_KEYS = [
  STORAGE_KEYS.EXTENSION_ENABLED,
  STORAGE_KEYS.SELECTED_FONT,
  STORAGE_KEYS.WEBSITE_LIST,
  STORAGE_KEYS.PINNED_WEBSITE_URLS,
  STORAGE_KEYS.ENABLED_BY_DEFAULT,
  STORAGE_KEYS.ENABLED_FOR,
  STORAGE_KEYS.DISABLED_FOR,
  STORAGE_KEYS.SITE_PROFILES,
  STORAGE_KEYS.CUSTOM_FONT_LIST,
  STORAGE_KEYS.GOOGLE_FONTS_ENABLED,
  STORAGE_KEYS.SYSTEM_FONTS_ENABLED,
  STORAGE_KEYS.TEXT_STROKE,
  STORAGE_KEYS.UI_LANGUAGE,
  STORAGE_KEYS.RTL_ENABLED,
  STORAGE_KEYS.RTL_SITE_SETTINGS,
  STORAGE_KEYS.CONTEXT_MENUS_ENABLED,
  STORAGE_KEYS.SYNC_SETTINGS
] as const

const LEGACY_IMPORT_STORAGE_KEYS = [STORAGE_KEYS.TEXT_STROKE_ENABLED] as const
const APP_NAME = "FontAra"
const LEGACY_APP_NAMES = ["FontARA"] as const

export type FontaraSettingsBackup = {
  app: typeof APP_NAME
  exportedAt: string
  extensionVersion?: string
  format: typeof FONTARA_SETTINGS_EXPORT_FORMAT
  settings: Record<string, unknown>
  version: typeof FONTARA_SETTINGS_EXPORT_VERSION
}

export type ParsedSettingsBackup = {
  settings: Record<string, unknown>
  version: number | null
}

export type NormalizedSettingsBackup = {
  ignoredKeyCount: number
  importedKeyCount: number
  settings: Record<string, unknown>
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.getOwnPropertyDescriptor(value, key) !== undefined
}

function isExportedStorageKey(key: string): boolean {
  return (FONTARA_SETTINGS_STORAGE_KEYS as readonly string[]).includes(key)
}

function isAcceptedImportStorageKey(key: string): boolean {
  return (
    isExportedStorageKey(key) ||
    (LEGACY_IMPORT_STORAGE_KEYS as readonly string[]).includes(key)
  )
}

function isAcceptedAppName(
  value: unknown
): value is typeof APP_NAME | (typeof LEGACY_APP_NAMES)[number] {
  return (
    value === APP_NAME ||
    (typeof value === "string" &&
      (LEGACY_APP_NAMES as readonly string[]).includes(value))
  )
}

export function getSettingsBackupDefaults(): Record<string, unknown> {
  return {
    [STORAGE_KEYS.EXTENSION_ENABLED]: DEFAULT_VALUES.EXTENSION_ENABLED,
    [STORAGE_KEYS.SELECTED_FONT]: DEFAULT_VALUES.SELECTED_FONT,
    [STORAGE_KEYS.WEBSITE_LIST]: DEFAULT_VALUES.WEBSITE_LIST,
    [STORAGE_KEYS.PINNED_WEBSITE_URLS]: DEFAULT_VALUES.PINNED_WEBSITE_URLS,
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: DEFAULT_VALUES.ENABLED_BY_DEFAULT,
    [STORAGE_KEYS.ENABLED_FOR]: DEFAULT_VALUES.ENABLED_FOR,
    [STORAGE_KEYS.DISABLED_FOR]: DEFAULT_VALUES.DISABLED_FOR,
    [STORAGE_KEYS.SITE_PROFILES]: DEFAULT_VALUES.SITE_PROFILES,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: DEFAULT_VALUES.CUSTOM_FONT_LIST,
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

function pickExportedSettings(
  values: Record<string, unknown>
): Record<string, unknown> {
  const defaults = getSettingsBackupDefaults()
  const settings: Record<string, unknown> = {}

  for (const key of FONTARA_SETTINGS_STORAGE_KEYS) {
    settings[key] = hasOwn(values, key) ? values[key] : defaults[key]
  }

  return settings
}

export function createSettingsBackup(
  values: Record<string, unknown>,
  metadata: { exportedAt?: Date; extensionVersion?: string } = {}
): FontaraSettingsBackup {
  const exportedAt = metadata.exportedAt ?? new Date()

  return {
    app: APP_NAME,
    format: FONTARA_SETTINGS_EXPORT_FORMAT,
    version: FONTARA_SETTINGS_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    ...(metadata.extensionVersion
      ? { extensionVersion: metadata.extensionVersion }
      : {}),
    settings: pickExportedSettings(values)
  }
}

export function createSettingsBackupFileName(date = new Date()): string {
  return `fontara-settings-${date.toISOString().slice(0, 10)}.json`
}

export function parseSettingsBackupText(text: string): ParsedSettingsBackup {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("invalid-json")
  }

  if (!isPlainRecord(parsed)) {
    throw new Error("invalid-settings-backup")
  }

  if (parsed.format === FONTARA_SETTINGS_EXPORT_FORMAT) {
    if (
      !isAcceptedAppName(parsed.app) ||
      typeof parsed.version !== "number" ||
      parsed.version > FONTARA_SETTINGS_EXPORT_VERSION ||
      !isPlainRecord(parsed.settings)
    ) {
      throw new Error("unsupported-settings-backup")
    }

    if (!Object.keys(parsed.settings).some(isAcceptedImportStorageKey)) {
      throw new Error("invalid-settings-backup")
    }

    return {
      settings: parsed.settings,
      version: parsed.version
    }
  }

  if (Object.keys(parsed).some(isAcceptedImportStorageKey)) {
    return {
      settings: parsed,
      version: null
    }
  }

  throw new Error("invalid-settings-backup")
}

export async function normalizeSettingsBackup(
  values: Record<string, unknown>
): Promise<NormalizedSettingsBackup> {
  const defaults = getSettingsBackupDefaults()
  const acceptedValues: Record<string, unknown> = { ...defaults }
  let importedKeyCount = 0
  let ignoredKeyCount = 0

  for (const [key, value] of Object.entries(values)) {
    if (!isAcceptedImportStorageKey(key)) {
      ignoredKeyCount += 1
      continue
    }

    acceptedValues[key] = value
    if (isExportedStorageKey(key)) {
      importedKeyCount += 1
    }
  }

  if (
    hasOwn(values, STORAGE_KEYS.TEXT_STROKE_ENABLED) &&
    !hasOwn(values, STORAGE_KEYS.TEXT_STROKE)
  ) {
    delete acceptedValues[STORAGE_KEYS.TEXT_STROKE]
  }

  return {
    ignoredKeyCount,
    importedKeyCount,
    settings: await normalizeStorageValues(acceptedValues)
  }
}

export async function createSettingsResetValues(): Promise<
  Record<string, unknown>
> {
  return normalizeStorageValues(getSettingsBackupDefaults())
}
