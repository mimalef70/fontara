export type StorageChange<T = unknown> = {
  oldValue?: T
  newValue?: T
}

export type StorageWatchers = Record<
  string,
  (change: StorageChange) => void | Promise<void>
>

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
  return error instanceof Error ? error.message : String(error)
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
