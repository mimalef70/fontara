import { getSettingsBackupDefaults } from "../utils/settings-backup"
import { getLocalValues, setLocalValues } from "../utils/storage"
import { normalizeStorageValues } from "../utils/storage-normalization"

type LocalStorageChanges = Record<string, chrome.storage.StorageChange>

let cachedSettings: Record<string, unknown> | null = null
let settingsReadPromise: Promise<Record<string, unknown>> | null = null

function valuesAreEqual(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second)
}

function pickChangedValues(
  currentValues: Record<string, unknown>,
  nextValues: Record<string, unknown>
): Record<string, unknown> {
  const changedValues: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(nextValues)) {
    if (!valuesAreEqual(currentValues[key], value)) {
      changedValues[key] = value
    }
  }

  return changedValues
}

async function readSettingsFromStorage(): Promise<Record<string, unknown>> {
  const values = await getLocalValues(getSettingsBackupDefaults())
  return normalizeStorageValues(values)
}

function hasOwn(value: object, key: string): boolean {
  return Object.getOwnPropertyDescriptor(value, key) !== undefined
}

function getStorageChangeValue(
  change: chrome.storage.StorageChange,
  fallback: unknown
): unknown {
  return hasOwn(change, "newValue") ? change.newValue : fallback
}

export function invalidateBackgroundSettingsCache(): void {
  cachedSettings = null
  settingsReadPromise = null
}

export async function getBackgroundSettings(): Promise<
  Record<string, unknown>
> {
  if (cachedSettings) return cachedSettings
  if (settingsReadPromise) return settingsReadPromise

  settingsReadPromise = readSettingsFromStorage()
    .then((settings) => {
      cachedSettings = settings
      return settings
    })
    .finally(() => {
      settingsReadPromise = null
    })

  return settingsReadPromise
}

export async function writeBackgroundSettings(
  nextValues: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const currentValues = await getBackgroundSettings()
  const normalizedValues = await normalizeStorageValues({
    ...currentValues,
    ...nextValues
  })
  const changedValues = pickChangedValues(currentValues, normalizedValues)

  if (Object.keys(changedValues).length > 0) {
    await setLocalValues(changedValues)
  }

  cachedSettings = normalizedValues
  settingsReadPromise = null
  return normalizedValues
}

export async function syncBackgroundSettingsCacheFromLocalChanges(
  changes: LocalStorageChanges
): Promise<Record<string, unknown> | null> {
  if (!cachedSettings) return null

  const defaults = getSettingsBackupDefaults()
  let hasSettingsChange = false
  const nextValues = { ...cachedSettings }

  for (const [key, change] of Object.entries(changes)) {
    if (!hasOwn(defaults, key)) continue

    hasSettingsChange = true
    nextValues[key] = getStorageChangeValue(change, defaults[key])
  }

  if (!hasSettingsChange) return cachedSettings

  const normalizedValues = await normalizeStorageValues(nextValues)
  const changedValues = pickChangedValues(nextValues, normalizedValues)
  cachedSettings = normalizedValues
  settingsReadPromise = null

  if (Object.keys(changedValues).length > 0) {
    await setLocalValues(changedValues)
  }

  return cachedSettings
}

export function resetBackgroundSettingsCacheForTesting(): void {
  invalidateBackgroundSettingsCache()
}
