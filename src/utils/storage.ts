export type StorageChange<T = unknown> = {
  oldValue?: T
  newValue?: T
}

export type StorageWatchers = Record<
  string,
  (change: StorageChange<any>) => void | Promise<void>
>

function getRuntimeError(): Error | null {
  const lastError = chrome.runtime?.lastError
  return lastError ? new Error(lastError.message) : null
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
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "local") return

    for (const [key, change] of Object.entries(changes)) {
      const watcher = watchers[key]
      if (watcher) {
        Promise.resolve(watcher(change)).catch((error) => {
          if (__DEBUG__) {
            console.warn(`Failed to handle ${key} storage change.`, error)
          }
        })
      }
    }
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
