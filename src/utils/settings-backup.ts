import { DEFAULT_VALUES, STORAGE_KEYS } from "../config/storage"
import type {
  CustomFontFamily,
  CustomFontFamilyDraft,
  LegacyCustomFontData
} from "../custom-font-types"
import { bytesToBase64, dataURLToCustomFontBytes } from "./custom-font-format"
import {
  isLegacyCustomFontData,
  normalizeCustomFontFamilies,
  normalizeLegacyCustomFontFamily
} from "./custom-font-normalization"
import {
  MAX_CUSTOM_FONT_FACES_PER_FAMILY,
  MAX_CUSTOM_FONT_FAMILIES,
  MAX_CUSTOM_FONT_FILE_SIZE_BYTES,
  MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES
} from "./custom-font-storage"
import { normalizeStorageValues } from "./storage-normalization"

export const FONTARA_SETTINGS_EXPORT_FORMAT = "fontara-settings"
export const FONTARA_SETTINGS_EXPORT_VERSION = 2
const MAX_BACKUP_FACE_COUNT =
  MAX_CUSTOM_FONT_FAMILIES * MAX_CUSTOM_FONT_FACES_PER_FAMILY
const MAX_BACKUP_FACE_BASE64_LENGTH =
  Math.ceil(MAX_CUSTOM_FONT_FILE_SIZE_BYTES / 3) * 4 + 4
export const MAX_SETTINGS_BACKUP_FILE_SIZE_BYTES =
  Math.ceil(MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES / 3) * 4 + 2 * 1024 * 1024

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
  customFontFaces: Record<string, string>
  version: typeof FONTARA_SETTINGS_EXPORT_VERSION
}

export type ParsedSettingsBackup = {
  customFontFaces: Record<string, string>
  settings: Record<string, unknown>
  version: number | null
}

export type PreparedCustomFontBackupFamily = {
  family: CustomFontFamilyDraft
  faceData: Record<string, string>
}

export type PreparedSettingsBackupImport = {
  customFontFamilies: PreparedCustomFontBackupFamily[]
  settings: Record<string, unknown>
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

function normalizeCustomFontFaceBackupMap(
  value: unknown
): Record<string, string> {
  if (!isPlainRecord(value)) return {}
  const entries = Object.entries(value)
  if (entries.length > MAX_BACKUP_FACE_COUNT) {
    throw new Error("custom-font-backup-face-limit")
  }
  const result: Record<string, string> = {}
  let decodedBytes = 0
  for (const [key, data] of entries) {
    if (
      key.length === 0 ||
      key.length > 128 ||
      typeof data !== "string" ||
      data.length === 0 ||
      data.length > MAX_BACKUP_FACE_BASE64_LENGTH ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        data
      )
    ) {
      throw new Error("invalid-custom-font-backup-face")
    }
    const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0
    decodedBytes += (data.length / 4) * 3 - padding
    if (decodedBytes > MAX_CUSTOM_FONT_LIBRARY_SIZE_BYTES) {
      throw new Error("custom-font-backup-library-size-limit")
    }
    result[key] = data
  }
  return result
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
  metadata: {
    customFontFaces?: Record<string, string>
    exportedAt?: Date
    extensionVersion?: string
  } = {}
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
    settings: pickExportedSettings(values),
    customFontFaces: metadata.customFontFaces ?? {}
  }
}

export function createSettingsBackupFileName(date = new Date()): string {
  return `fontara-settings-${date.toISOString().slice(0, 10)}.json`
}

export function parseSettingsBackupText(text: string): ParsedSettingsBackup {
  if (text.length > MAX_SETTINGS_BACKUP_FILE_SIZE_BYTES) {
    throw new Error("settings-backup-file-size-limit")
  }
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
      customFontFaces: normalizeCustomFontFaceBackupMap(parsed.customFontFaces),
      settings: parsed.settings,
      version: parsed.version
    }
  }

  if (Object.keys(parsed).some(isAcceptedImportStorageKey)) {
    return {
      customFontFaces: {},
      settings: parsed,
      version: null
    }
  }

  throw new Error("invalid-settings-backup")
}

function toFamilyDraft(family: CustomFontFamily): CustomFontFamilyDraft {
  const { revision: _revision, ...draft } = family
  return draft
}

export async function prepareSettingsBackupImport(
  parsed: ParsedSettingsBackup
): Promise<PreparedSettingsBackupImport> {
  const rawFonts = parsed.settings[STORAGE_KEYS.CUSTOM_FONT_LIST]
  if (!Array.isArray(rawFonts) || rawFonts.length === 0) {
    return { customFontFamilies: [], settings: parsed.settings }
  }
  if (rawFonts.length > MAX_CUSTOM_FONT_FAMILIES) {
    throw new Error("custom-font-library-family-limit")
  }

  const customFontFamilies: PreparedCustomFontBackupFamily[] = []
  const normalizedFamilies: CustomFontFamily[] = []
  for (const candidate of rawFonts) {
    if (isLegacyCustomFontData(candidate)) {
      const legacy = candidate as LegacyCustomFontData
      if (legacy.data.length > MAX_BACKUP_FACE_BASE64_LENGTH + 256) {
        throw new Error("custom-font-face-size-limit")
      }
      const family = await normalizeLegacyCustomFontFamily(legacy)
      const bytes = dataURLToCustomFontBytes(legacy.data)
      if (!family || !bytes || family.faces[0].validation === "failed") {
        throw new Error("invalid-custom-font-backup")
      }
      normalizedFamilies.push(family)
      customFontFamilies.push({
        family: toFamilyDraft(family),
        faceData: { [family.faces[0].id]: bytesToBase64(bytes) }
      })
      continue
    }

    const candidateFaces =
      candidate && typeof candidate === "object"
        ? (candidate as Partial<CustomFontFamily>).faces
        : null
    if (
      !Array.isArray(candidateFaces) ||
      candidateFaces.length === 0 ||
      candidateFaces.length > MAX_CUSTOM_FONT_FACES_PER_FAMILY
    ) {
      throw new Error("custom-font-family-face-limit")
    }
    const [family] = await normalizeCustomFontFamilies([candidate])
    if (!family) throw new Error("invalid-custom-font-backup")
    const faceData: Record<string, string> = {}
    for (const face of family.faces) {
      const data = parsed.customFontFaces[face.id]
      if (typeof data !== "string" || data.length === 0) {
        throw new Error("missing-custom-font-backup-face")
      }
      faceData[face.id] = data
    }
    normalizedFamilies.push(family)
    customFontFamilies.push({ family: toFamilyDraft(family), faceData })
  }

  return {
    customFontFamilies,
    settings: {
      ...parsed.settings,
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: normalizedFamilies
    }
  }
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
