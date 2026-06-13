export type StorageChange<T = unknown> = {
  oldValue?: T
  newValue?: T
}

export type StorageWatchers = Record<
  string,
  (change: StorageChange) => void | Promise<void>
>

const DEFAULT_SYNC_QUOTA_BYTES_PER_ITEM = 8192
const DEFAULT_SYNC_MAX_ITEMS = 512
const SYNC_STORAGE_CHUNK_META_KEY = "__meta_split_count"

type StorageChangedEvent = typeof chrome.storage.onChanged

function getRuntimeError(): Error | null {
  const lastError = chrome.runtime?.lastError
  return lastError ? new Error(lastError.message) : null
}

function getStorageChangedEvent(): StorageChangedEvent | null {
  if (typeof chrome === "undefined") return null

  return chrome.storage?.onChanged ?? null
}

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return String(error)
}

function isExpectedStorageListenerError(error: unknown): boolean {
  return /extension context invalidated|context invalidated|cannot read (?:properties|property) of undefined \(reading ['"]onChanged['"]\)/i.test(
    getErrorMessage(error)
  )
}

export function getLocalValue<T = unknown>(
  key: string
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (items) => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve(items[key] as T | undefined)
    })
  })
}

export function setLocalValue<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

export function setLocalValues<T extends Record<string, unknown>>(
  values: T
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

export function getLocalValues<T extends Record<string, unknown>>(
  defaults: T
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(defaults, (items) => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve(items as T)
    })
  })
}

export function getLocalBytesInUse(
  keys?: string | string[] | null
): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.getBytesInUse(keys ?? null, (bytesInUse) => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve(bytesInUse)
    })
  })
}

function getSyncStorageArea(): chrome.storage.SyncStorageArea | null {
  if (typeof chrome === "undefined") return null

  return chrome.storage?.sync ?? null
}

function getSyncQuotaBytesPerItem(): number {
  return (
    getSyncStorageArea()?.QUOTA_BYTES_PER_ITEM ??
    DEFAULT_SYNC_QUOTA_BYTES_PER_ITEM
  )
}

function getSyncMaxItems(): number {
  return getSyncStorageArea()?.MAX_ITEMS ?? DEFAULT_SYNC_MAX_ITEMS
}

function getSyncStorageItemBytes(key: string, value: unknown): number {
  return new TextEncoder().encode(JSON.stringify({ [key]: value })).byteLength
}

function createSyncStorageChunkKey(key: string, index: number): string {
  return `${key}_${index.toString(36)}`
}

function getSyncStorageSplitCount(value: unknown): number {
  if (typeof value !== "object" || value === null) return 0

  const splitCount = (value as Record<string, unknown>)[
    SYNC_STORAGE_CHUNK_META_KEY
  ]
  return Number.isInteger(splitCount) && Number(splitCount) > 0
    ? Number(splitCount)
    : 0
}

function splitSyncStorageValue(
  key: string,
  serializedValue: string,
  quotaBytesPerItem: number
): string[] {
  const chunks: string[] = []
  let offset = 0

  while (offset < serializedValue.length) {
    const chunkKey = createSyncStorageChunkKey(key, chunks.length)
    let bestEnd = offset
    let low = offset + 1
    let high = serializedValue.length

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const candidate = serializedValue.slice(offset, mid)

      if (getSyncStorageItemBytes(chunkKey, candidate) <= quotaBytesPerItem) {
        bestEnd = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    if (bestEnd === offset) {
      throw new Error("sync-storage-item-too-large")
    }

    chunks.push(serializedValue.slice(offset, bestEnd))
    offset = bestEnd
  }

  return chunks
}

function reassembleSyncStorageChunks(
  values: Record<string, unknown>
): Record<string, unknown> | null {
  const reassembledValues = { ...values }

  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "object" || value === null) {
      continue
    }

    const splitCount = (value as Record<string, unknown>)[
      SYNC_STORAGE_CHUNK_META_KEY
    ]
    if (typeof splitCount !== "number" || splitCount <= 0) {
      continue
    }

    let serializedValue = ""
    for (let index = 0; index < splitCount; index += 1) {
      const chunkKey = createSyncStorageChunkKey(key, index)
      const chunk = reassembledValues[chunkKey]
      if (typeof chunk !== "string") {
        return null
      }

      serializedValue += chunk
      delete reassembledValues[chunkKey]
    }

    try {
      reassembledValues[key] = JSON.parse(serializedValue)
    } catch {
      return null
    }
  }

  return reassembledValues
}

function prepareSyncStorageValues<T extends Record<string, unknown>>(
  values: T
): Record<string, unknown> {
  const preparedValues: Record<string, unknown> = { ...values }
  const quotaBytesPerItem = getSyncQuotaBytesPerItem()
  const maxItems = getSyncMaxItems()

  for (const key of Object.keys(values)) {
    const serializedValue = JSON.stringify(values[key])
    if (getSyncStorageItemBytes(key, values[key]) <= quotaBytesPerItem) {
      continue
    }

    const chunks = splitSyncStorageValue(
      key,
      serializedValue,
      quotaBytesPerItem
    )
    for (let index = 0; index < chunks.length; index += 1) {
      preparedValues[createSyncStorageChunkKey(key, index)] = chunks[index]
    }
    preparedValues[key] = {
      [SYNC_STORAGE_CHUNK_META_KEY]: chunks.length
    }
  }

  if (Object.keys(preparedValues).length > maxItems) {
    throw new Error("sync-storage-too-many-items")
  }

  return preparedValues
}

function getObsoleteSyncStorageChunkKeys(
  currentValues: Record<string, unknown>,
  retainedValues: Record<string, unknown>,
  updatedKeys: string[]
): string[] {
  const obsoleteKeys: string[] = []

  for (const key of updatedKeys) {
    const currentSplitCount = getSyncStorageSplitCount(currentValues[key])
    if (currentSplitCount === 0) continue

    const retainedSplitCount = getSyncStorageSplitCount(retainedValues[key])
    for (
      let index = retainedSplitCount;
      index < currentSplitCount;
      index += 1
    ) {
      obsoleteKeys.push(createSyncStorageChunkKey(key, index))
    }
  }

  return obsoleteKeys
}

function getSyncRawValues(
  syncStorage: chrome.storage.SyncStorageArea
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    syncStorage.get(null, (items) => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve(items as Record<string, unknown>)
    })
  })
}

function setSyncRawValues(
  syncStorage: chrome.storage.SyncStorageArea,
  values: Record<string, unknown>
): Promise<void> {
  return new Promise((resolve, reject) => {
    syncStorage.set(values, () => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function removeSyncRawValues(
  syncStorage: chrome.storage.SyncStorageArea,
  keys: string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (keys.length === 0) {
      resolve()
      return
    }

    syncStorage.remove(keys, () => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

export function getSyncValues<T extends Record<string, unknown>>(
  defaults: T
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const syncStorage = getSyncStorageArea()
    if (!syncStorage) {
      resolve(null)
      return
    }

    syncStorage.get(null, (items) => {
      const error = getRuntimeError()
      if (error) {
        reject(error)
        return
      }

      const reassembledItems = reassembleSyncStorageChunks(
        items as Record<string, unknown>
      )
      if (!reassembledItems) {
        resolve(null)
        return
      }

      resolve({ ...defaults, ...reassembledItems } as T)
    })
  })
}

export async function setSyncValues<T extends Record<string, unknown>>(
  values: T
): Promise<void> {
  const syncStorage = getSyncStorageArea()
  if (!syncStorage) {
    throw new Error("sync-storage-unavailable")
  }

  const preparedValues = prepareSyncStorageValues(values)
  const currentValues = await getSyncRawValues(syncStorage)

  await setSyncRawValues(syncStorage, preparedValues)
  const latestValues = await getSyncRawValues(syncStorage)
  const obsoleteChunkKeys = getObsoleteSyncStorageChunkKeys(
    currentValues,
    latestValues,
    Object.keys(values)
  )
  await removeSyncRawValues(syncStorage, obsoleteChunkKeys)
}

export function watchLocalStorage(watchers: StorageWatchers): () => void {
  const storageChanged = getStorageChangedEvent()
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "local") return

    for (const [key, change] of Object.entries(changes)) {
      const watcher = watchers[key]
      if (watcher) {
        Promise.resolve(watcher(change)).catch((error) => {
          debugWarn(`Failed to handle ${key} storage change.`, error)
        })
      }
    }
  }

  try {
    storageChanged?.addListener(listener)
  } catch (error) {
    if (!isExpectedStorageListenerError(error)) {
      debugWarn("Failed to watch extension storage changes.", error)
    }
    return () => {}
  }

  return () => {
    try {
      storageChanged?.removeListener(listener)
    } catch (error) {
      if (!isExpectedStorageListenerError(error)) {
        debugWarn("Failed to stop watching extension storage changes.", error)
      }
    }
  }
}
