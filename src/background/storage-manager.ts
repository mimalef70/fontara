import { STORAGE_KEYS } from "../config/storage"
import {
  createSyncedSettings,
  FONTARA_SYNCED_STORAGE_KEYS,
  getLocalStorageReadDefaults,
  getSettingsSyncReadDefaults,
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

const SYNC_SAVE_DELAY_MS = 1000

let syncSaveTimeout: ReturnType<typeof setTimeout> | null = null
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

async function saveSyncedSettingsFromLocal(): Promise<void> {
  const localValues = await getLocalValues(getLocalStorageReadDefaults())
  if (!isSyncSettingsEnabled(localValues[STORAGE_KEYS.SYNC_SETTINGS])) {
    return
  }

  try {
    await setSyncValues(await createSyncedSettings(localValues))
  } catch (error) {
    logSyncError("Settings synchronization was disabled due to error.", error)
    await saveSyncSetting(false)
  }
}

function scheduleSyncedSettingsSave(): void {
  if (syncSaveTimeout !== null) {
    clearTimeout(syncSaveTimeout)
  }

  syncSaveTimeout = setTimeout(() => {
    syncSaveTimeout = null
    void saveSyncedSettingsFromLocal()
  }, SYNC_SAVE_DELAY_MS)
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

  const mergedValues = await mergeSyncedSettingsWithLocalOnlyValues(
    localValues,
    syncedValues
  )

  applyingSyncToLocal = true
  try {
    await setLocalValuesIfChanged(localValues, mergedValues)
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
    await setLocalValuesIfChanged(localValues, normalizedLocalValues)
    await saveSyncedSettingsFromLocal()
    return
  }

  const mergedValues = await mergeSyncedSettingsWithLocalOnlyValues(
    localValues,
    syncedValues
  )
  await setLocalValuesIfChanged(localValues, mergedValues)
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
          scheduleSyncedSettingsSave()
        }
      })
      return
    }

    if (FONTARA_SYNCED_STORAGE_KEYS.some((key) => key in changes)) {
      scheduleSyncedSettingsSave()
    }
  })
}
