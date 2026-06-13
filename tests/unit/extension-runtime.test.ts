import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { ExtensionRuntime } from "../../src/background/extension"
import { flushPendingSettingsSync } from "../../src/background/storage-manager"
import { STORAGE_KEYS } from "../../src/config/storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalDebug = Reflect.get(globalThis, "__DEBUG__") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__DEBUG__", originalDebug)
})

function createStorageChange(
  oldValue: unknown,
  newValue: unknown
): chrome.storage.StorageChange {
  return { newValue, oldValue }
}

function installChromeRuntimeMock(
  localValues: Record<string, unknown>,
  syncValues: Record<string, unknown>
): void {
  let runtimeError: { message?: string } | undefined
  const storageListeners: Array<
    (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => void
  > = []

  const notifyStorageListeners = (
    areaName: string,
    previousValues: Record<string, unknown>,
    nextValues: Record<string, unknown>
  ) => {
    const changes = Object.fromEntries(
      Object.entries(nextValues).map(([key, newValue]) => [
        key,
        createStorageChange(previousValues[key], newValue)
      ])
    )

    for (const listener of storageListeners) {
      listener(changes, areaName)
    }
  }

  Reflect.set(globalThis, "__DEBUG__", false)
  Reflect.set(globalThis, "chrome", {
    action: {
      async setIcon() {}
    },
    commands: {
      getAll(callback: (commands: chrome.commands.Command[]) => void) {
        callback([])
      },
      onCommand: {
        addListener() {}
      }
    },
    i18n: {
      getMessage(_key: string, fallback?: string) {
        return fallback || ""
      }
    },
    runtime: {
      get lastError() {
        return runtimeError
      },
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      },
      onInstalled: {
        addListener() {}
      },
      onMessage: {
        addListener() {}
      },
      sendMessage() {},
      setUninstallURL() {}
    },
    storage: {
      local: {
        get(
          key: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          runtimeError = undefined
          if (typeof key === "string") {
            callback({ [key]: localValues[key] })
            return
          }

          callback({ ...key, ...localValues })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          runtimeError = undefined
          const previousValues = { ...localValues }
          Object.assign(localValues, items)
          callback()
          notifyStorageListeners("local", previousValues, items)
        }
      },
      onChanged: {
        addListener(listener: (typeof storageListeners)[number]) {
          storageListeners.push(listener)
        },
        removeListener() {}
      },
      sync: {
        QUOTA_BYTES_PER_ITEM: 8192,
        get(_key: null, callback: (items: Record<string, unknown>) => void) {
          runtimeError = undefined
          callback({ ...syncValues })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          runtimeError = undefined
          Object.assign(syncValues, items)
          callback()
        }
      }
    },
    tabs: {
      create() {},
      onActivated: {
        addListener() {}
      },
      onRemoved: {
        addListener() {}
      },
      onUpdated: {
        addListener() {}
      },
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void
      ) {
        const tabs = [{ id: 1, url: "https://example.com" } as chrome.tabs.Tab]
        callback?.(tabs)
        return Promise.resolve(tabs)
      },
      sendMessage(
        _tabId: number,
        _message: unknown,
        _options?: chrome.tabs.MessageSendOptions,
        callback?: () => void
      ) {
        callback?.()
      }
    }
  })
}

test("runtime collect does not re-apply stale sync values after a local settings change", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.SYNC_SETTINGS]: true,
    [STORAGE_KEYS.UI_LANGUAGE]: "auto"
  }
  const syncValues: Record<string, unknown> = {
    [STORAGE_KEYS.SYNC_SETTINGS]: true,
    [STORAGE_KEYS.UI_LANGUAGE]: "auto"
  }
  installChromeRuntimeMock(localValues, syncValues)

  await ExtensionRuntime.changeSettings({
    [STORAGE_KEYS.UI_LANGUAGE]: "fa"
  })

  assert.equal(syncValues[STORAGE_KEYS.UI_LANGUAGE], "auto")

  await new Promise((resolve) => setTimeout(resolve, 80))

  assert.equal(localValues[STORAGE_KEYS.UI_LANGUAGE], "fa")

  await new Promise((resolve) => setTimeout(resolve, 1100))

  assert.equal(localValues[STORAGE_KEYS.UI_LANGUAGE], "fa")
  assert.equal(syncValues[STORAGE_KEYS.UI_LANGUAGE], "auto")

  await flushPendingSettingsSync()

  assert.equal(syncValues[STORAGE_KEYS.UI_LANGUAGE], "fa")
})
