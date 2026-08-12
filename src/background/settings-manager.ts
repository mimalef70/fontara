import { STORAGE_KEYS } from "../config/storage"
import { getSettingsBackupDefaults } from "../utils/settings-backup"
import {
  createSettingsUpdatedAtPatch,
  FONTARA_SETTINGS_REVISION_KEY
} from "../utils/settings-sync"
import { getLocalValues, setLocalValues } from "../utils/storage"
import { normalizeStorageValues } from "../utils/storage-normalization"

type LocalStorageChanges = Record<string, chrome.storage.StorageChange>

let cachedSettings: Record<string, unknown> | null = null
let cachedRevision = 0
let settingsReadPromise: Promise<Record<string, unknown>> | null = null
let settingsOperationQueue: Promise<void> = Promise.resolve()

export type BackgroundSettingsWriteResult = {
  revision: number
  settings: Record<string, unknown>
  syncSnapshot: Record<string, unknown>
}

export type BackgroundSettingsSnapshot = {
  revision: number
  settings: Record<string, unknown>
}

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

function normalizeRevision(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0
}

async function readSettingsSnapshotFromStorage(): Promise<BackgroundSettingsSnapshot> {
  const values: Record<string, unknown> = await getLocalValues({
    ...getSettingsBackupDefaults(),
    [FONTARA_SETTINGS_REVISION_KEY]: 0
  })
  const revision = normalizeRevision(values[FONTARA_SETTINGS_REVISION_KEY])
  delete values[FONTARA_SETTINGS_REVISION_KEY]

  return {
    revision,
    settings: await normalizeStorageValues(values)
  }
}

async function readSettingsFromStorage(): Promise<Record<string, unknown>> {
  const snapshot = await readSettingsSnapshotFromStorage()
  cachedRevision = snapshot.revision
  return snapshot.settings
}

function enqueueSettingsOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = settingsOperationQueue.then(operation, operation)
  settingsOperationQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
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
  cachedRevision = 0
  settingsReadPromise = null
}

export async function getBackgroundSettings(): Promise<
  Record<string, unknown>
> {
  await settingsOperationQueue
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

export async function getBackgroundSettingsSnapshot(): Promise<BackgroundSettingsSnapshot> {
  const settings = await getBackgroundSettings()
  return {
    revision: cachedRevision,
    settings
  }
}

export async function writeBackgroundSettingsWithSyncSnapshot(
  nextValues: Record<string, unknown>
): Promise<BackgroundSettingsWriteResult> {
  return enqueueSettingsOperation(async () => {
    const currentSnapshot = await readSettingsSnapshotFromStorage()
    const currentValues = currentSnapshot.settings
    const normalizedValues = await normalizeStorageValues({
      ...currentValues,
      ...nextValues
    })
    const changedValues = pickChangedValues(currentValues, normalizedValues)
    if (
      hasOwn(nextValues, STORAGE_KEYS.CUSTOM_FONT_LIST) &&
      !hasOwn(changedValues, STORAGE_KEYS.CUSTOM_FONT_LIST)
    ) {
      // Startup keeps an unrecognized raw catalog recoverable in local storage,
      // while currentValues is the normalized in-memory view. An explicit
      // import/reset/font mutation must still be able to replace that raw value
      // even when both normalized views happen to be equal (commonly []).
      changedValues[STORAGE_KEYS.CUSTOM_FONT_LIST] =
        normalizedValues[STORAGE_KEYS.CUSTOM_FONT_LIST]
    }
    const hasChanges = Object.keys(changedValues).length > 0
    const revision = hasChanges
      ? Math.max(cachedRevision, currentSnapshot.revision) + 1
      : Math.max(cachedRevision, currentSnapshot.revision)
    const settingsUpdatedAtPatch = hasChanges
      ? createSettingsUpdatedAtPatch()
      : {}

    cachedSettings = normalizedValues
    cachedRevision = revision
    settingsReadPromise = null

    if (hasChanges) {
      try {
        await setLocalValues({
          ...changedValues,
          ...settingsUpdatedAtPatch,
          [FONTARA_SETTINGS_REVISION_KEY]: revision
        })
      } catch (error) {
        cachedSettings = currentValues
        cachedRevision = currentSnapshot.revision
        throw error
      }
    }

    return {
      revision,
      settings: normalizedValues,
      syncSnapshot: {
        ...normalizedValues,
        ...settingsUpdatedAtPatch,
        [FONTARA_SETTINGS_REVISION_KEY]: revision
      }
    }
  })
}

export async function writeBackgroundSettings(
  nextValues: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return (await writeBackgroundSettingsWithSyncSnapshot(nextValues)).settings
}

export async function syncBackgroundSettingsCacheFromLocalChanges(
  changes: LocalStorageChanges
): Promise<Record<string, unknown> | null> {
  return enqueueSettingsOperation(async () => {
    const defaults = getSettingsBackupDefaults()
    const hasSettingsChange = Object.keys(changes).some((key) =>
      hasOwn(defaults, key)
    )
    const revisionChange = changes[FONTARA_SETTINGS_REVISION_KEY]
    const incomingRevision = revisionChange
      ? normalizeRevision(getStorageChangeValue(revisionChange, cachedRevision))
      : cachedRevision
    const currentSettings = cachedSettings

    if (!hasSettingsChange) {
      cachedRevision = Math.max(cachedRevision, incomingRevision)
      return null
    }
    if (!currentSettings) {
      const snapshot = await readSettingsSnapshotFromStorage()
      cachedSettings = snapshot.settings
      cachedRevision = snapshot.revision
      return snapshot.settings
    }

    const nextValues = { ...currentSettings }
    for (const [key, change] of Object.entries(changes)) {
      if (!hasOwn(defaults, key)) continue

      nextValues[key] = getStorageChangeValue(change, defaults[key])
    }

    const normalizedValues = await normalizeStorageValues(nextValues)
    const effectiveChangedValues = pickChangedValues(
      currentSettings,
      normalizedValues
    )
    if (Object.keys(effectiveChangedValues).length === 0) {
      cachedRevision = Math.max(cachedRevision, incomingRevision)
      return null
    }

    const changedValues = pickChangedValues(nextValues, normalizedValues)
    const revision = Math.max(cachedRevision, incomingRevision) + 1
    cachedSettings = normalizedValues
    cachedRevision = revision
    settingsReadPromise = null

    await setLocalValues({
      ...changedValues,
      [FONTARA_SETTINGS_REVISION_KEY]: revision
    })

    return cachedSettings
  })
}

export function resetBackgroundSettingsCacheForTesting(): void {
  invalidateBackgroundSettingsCache()
  settingsOperationQueue = Promise.resolve()
}
