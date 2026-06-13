import { STORAGE_KEYS } from "../config/storage"
import {
  createSyncedSettings,
  FONTARA_SETTINGS_UPDATED_AT_KEY,
  FONTARA_SYNCED_STORAGE_KEYS,
  getLocalStorageReadDefaults,
  getSettingsSyncReadDefaults,
  getSettingsUpdatedAt,
  hasSyncedSettingsValues,
  mergeSyncedSettingsWithLocalOnlyValues
} from "../utils/settings-sync"
import {
  getLocalValues,
  getSyncValues,
  setLocalValues,
  setSyncValues
} from "../utils/storage"
import {
  mergeWebsiteLists,
  normalizeCustomFontList,
  normalizeStorageValues
} from "../utils/storage-normalization"

export { mergeWebsiteLists, normalizeCustomFontList }

const SYNC_SAVE_DELAY_MS = 3000

let syncSaveTimeout: ReturnType<typeof setTimeout> | null = null
let pendingSyncValues: Record<string, unknown> | null = null
let applyingSyncToLocal = false

function isSyncSettingsEnabled(value: unknown): boolean {
  return value !== false
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

function logSyncError(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

async function setLocalValuesIfChanged(
  currentValues: Record<string, unknown>,
  nextValues: Record<string, unknown>
): Promise<void> {
  const changedValues = pickChangedValues(currentValues, nextValues)
  if (Object.keys(changedValues).length === 0) {
    return
  }

  await setLocalValues(changedValues)
}

async function saveSyncSetting(syncSettings: boolean): Promise<void> {
  const localSyncSetting = await getLocalValues({
    [STORAGE_KEYS.SYNC_SETTINGS]: undefined
  })
  if (localSyncSetting[STORAGE_KEYS.SYNC_SETTINGS] !== syncSettings) {
    await setLocalValues({ [STORAGE_KEYS.SYNC_SETTINGS]: syncSettings })
  }

  try {
    await setSyncValues({ [STORAGE_KEYS.SYNC_SETTINGS]: syncSettings })
  } catch (error) {
    if (syncSettings) {
      logSyncError("Settings synchronization was disabled due to error.", error)
      await setLocalValues({ [STORAGE_KEYS.SYNC_SETTINGS]: false })
    }
  }
}

async function saveSyncedSettings(
  values: Record<string, unknown>
): Promise<void> {
  if (!isSyncSettingsEnabled(values[STORAGE_KEYS.SYNC_SETTINGS])) {
    await saveSyncSetting(false)
    return
  }

  try {
    await setSyncValues(await createSyncedSettings(values))
  } catch (error) {
    logSyncError("Settings synchronization was disabled due to error.", error)
    await saveSyncSetting(false)
  }
}

async function saveSyncedSettingsFromLocal(): Promise<void> {
  await saveSyncedSettings(await getLocalValues(getLocalStorageReadDefaults()))
}

export function schedulePendingSettingsSync(
  values?: Record<string, unknown>
): void {
  if (values) {
    pendingSyncValues = values
  }

  if (syncSaveTimeout !== null) {
    clearTimeout(syncSaveTimeout)
  }

  syncSaveTimeout = setTimeout(() => {
    const valuesToSave = pendingSyncValues
    pendingSyncValues = null
    syncSaveTimeout = null
    void (valuesToSave
      ? saveSyncedSettings(valuesToSave)
      : saveSyncedSettingsFromLocal())
  }, SYNC_SAVE_DELAY_MS)
}

export async function flushPendingSettingsSync(
  values?: Record<string, unknown>
): Promise<void> {
  if (syncSaveTimeout !== null) {
    clearTimeout(syncSaveTimeout)
    syncSaveTimeout = null
  }

  const valuesToSave = values ?? pendingSyncValues
  pendingSyncValues = null

  await (valuesToSave
    ? saveSyncedSettings(valuesToSave)
    : saveSyncedSettingsFromLocal())
}

async function applySyncStorageToLocal(): Promise<void> {
  const localValues = await getLocalValues(getLocalStorageReadDefaults())
  if (!isSyncSettingsEnabled(localValues[STORAGE_KEYS.SYNC_SETTINGS])) {
    return
  }

  let syncedValues: Record<string, unknown> | null
  try {
    syncedValues = await getSyncValues(getSettingsSyncReadDefaults())
  } catch (error) {
    logSyncError("Settings synchronization was disabled due to error.", error)
    await saveSyncSetting(false)
    return
  }

  if (!syncedValues) {
    logSyncError(
      "Settings synchronization was disabled because synced settings are missing.",
      new Error("sync-settings-missing")
    )
    await saveSyncSetting(false)
    return
  }

  if (syncedValues[STORAGE_KEYS.SYNC_SETTINGS] === false) {
    applyingSyncToLocal = true
    try {
      await setLocalValuesIfChanged(localValues, {
        ...localValues,
        [STORAGE_KEYS.SYNC_SETTINGS]: false
      })
    } finally {
      applyingSyncToLocal = false
    }
    return
  }

  if (!hasSyncedSettingsValues(syncedValues)) {
    await saveSyncedSettingsFromLocal()
    return
  }

  if (getSettingsUpdatedAt(localValues) > getSettingsUpdatedAt(syncedValues)) {
    await saveSyncedSettingsFromLocal()
    return
  }

  const latestLocalValues = await getLocalValues(getLocalStorageReadDefaults())
  if (!isSyncSettingsEnabled(latestLocalValues[STORAGE_KEYS.SYNC_SETTINGS])) {
    return
  }
  if (
    getSettingsUpdatedAt(latestLocalValues) > getSettingsUpdatedAt(syncedValues)
  ) {
    await saveSyncedSettingsFromLocal()
    return
  }

  const mergedValues = await mergeSyncedSettingsWithLocalOnlyValues(
    latestLocalValues,
    syncedValues
  )

  applyingSyncToLocal = true
  try {
    await setLocalValuesIfChanged(latestLocalValues, mergedValues)
  } finally {
    applyingSyncToLocal = false
  }
}

export async function ensureStorageValues(): Promise<void> {
  const localValues = await getLocalValues(getLocalStorageReadDefaults())
  const normalizedLocalValues = await normalizeStorageValues(localValues)

  if (
    !isSyncSettingsEnabled(normalizedLocalValues[STORAGE_KEYS.SYNC_SETTINGS])
  ) {
    await setLocalValuesIfChanged(localValues, normalizedLocalValues)
    return
  }

  let syncedValues: Record<string, unknown> | null
  try {
    syncedValues = await getSyncValues(getSettingsSyncReadDefaults())
  } catch (error) {
    logSyncError("Settings synchronization was disabled due to error.", error)
    await setLocalValuesIfChanged(localValues, {
      ...normalizedLocalValues,
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await saveSyncSetting(false)
    return
  }

  if (!syncedValues) {
    logSyncError(
      "Settings synchronization was disabled because synced settings are missing.",
      new Error("sync-settings-missing")
    )
    await setLocalValuesIfChanged(localValues, {
      ...normalizedLocalValues,
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    await saveSyncSetting(false)
    return
  }

  if (syncedValues[STORAGE_KEYS.SYNC_SETTINGS] === false) {
    await setLocalValuesIfChanged(localValues, {
      ...normalizedLocalValues,
      [STORAGE_KEYS.SYNC_SETTINGS]: false
    })
    return
  }

  if (!hasSyncedSettingsValues(syncedValues)) {
    const latestLocalValues = await getLocalValues(
      getLocalStorageReadDefaults()
    )
    const latestNormalizedLocalValues =
      await normalizeStorageValues(latestLocalValues)
    const latestUpdatedAt = getSettingsUpdatedAt(latestLocalValues)

    await setLocalValuesIfChanged(latestLocalValues, {
      ...latestNormalizedLocalValues,
      ...(latestUpdatedAt > 0
        ? { [FONTARA_SETTINGS_UPDATED_AT_KEY]: latestUpdatedAt }
        : {})
    })
    await saveSyncedSettingsFromLocal()
    return
  }

  if (getSettingsUpdatedAt(localValues) > getSettingsUpdatedAt(syncedValues)) {
    await setLocalValuesIfChanged(localValues, {
      ...normalizedLocalValues,
      [FONTARA_SETTINGS_UPDATED_AT_KEY]: getSettingsUpdatedAt(localValues)
    })
    await saveSyncedSettingsFromLocal()
    return
  }

  const latestLocalValues = await getLocalValues(getLocalStorageReadDefaults())
  if (
    getSettingsUpdatedAt(latestLocalValues) > getSettingsUpdatedAt(syncedValues)
  ) {
    await setLocalValuesIfChanged(latestLocalValues, {
      ...(await normalizeStorageValues(latestLocalValues)),
      [FONTARA_SETTINGS_UPDATED_AT_KEY]: getSettingsUpdatedAt(latestLocalValues)
    })
    await saveSyncedSettingsFromLocal()
    return
  }

  const mergedValues = await mergeSyncedSettingsWithLocalOnlyValues(
    latestLocalValues,
    syncedValues
  )
  await setLocalValuesIfChanged(latestLocalValues, mergedValues)
}

export function registerSettingsSyncListeners(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync") {
      void applySyncStorageToLocal()
      return
    }

    if (areaName !== "local" || applyingSyncToLocal) {
      return
    }

    if (changes[STORAGE_KEYS.SYNC_SETTINGS]) {
      const syncSettings = isSyncSettingsEnabled(
        changes[STORAGE_KEYS.SYNC_SETTINGS].newValue
      )
      void saveSyncSetting(syncSettings).then(() => {
        if (syncSettings) {
          schedulePendingSettingsSync()
        }
      })
      return
    }

    if (FONTARA_SYNCED_STORAGE_KEYS.some((key) => key in changes)) {
      schedulePendingSettingsSync()
    }
  })
}
