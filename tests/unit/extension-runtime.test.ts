import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"

import { ExtensionRuntime } from "../../src/background/extension"
import { BackgroundGoogleFontManager } from "../../src/background/google-font-manager"
import {
  getBackgroundSettings,
  invalidateBackgroundSettingsCache,
  writeBackgroundSettings
} from "../../src/background/settings-manager"
import { flushPendingSettingsSync } from "../../src/background/storage-manager"
import { STORAGE_KEYS } from "../../src/config/storage"
import {
  CUSTOM_FONT_FACE_STORAGE_PREFIX,
  CUSTOM_FONT_STORAGE_SCHEMA_VERSION,
  CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY
} from "../../src/utils/custom-font-storage"
import { FONTARA_SETTINGS_REVISION_KEY } from "../../src/utils/settings-sync"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalDebug = Reflect.get(globalThis, "__DEBUG__") as unknown

beforeEach(() => {
  invalidateBackgroundSettingsCache()
})

afterEach(() => {
  invalidateBackgroundSettingsCache()
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
          key: string | string[] | Record<string, unknown> | null,
          callback: (items: Record<string, unknown>) => void
        ) {
          runtimeError = undefined
          if (key === null) {
            callback({ ...localValues })
            return
          }
          if (typeof key === "string") {
            callback({ [key]: localValues[key] })
            return
          }
          if (Array.isArray(key)) {
            callback(
              Object.fromEntries(key.map((item) => [item, localValues[item]]))
            )
            return
          }

          callback({ ...key, ...localValues })
        },
        remove(keys: string | string[], callback: () => void) {
          runtimeError = undefined
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete localValues[key]
          }
          callback()
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

test("partial settings import preserves quarantined custom fonts and their blobs", async () => {
  const fileHash = "a".repeat(64)
  const familyValue = "ForwardCatalog-Fontara"
  const rawCatalog = [
    {
      futureSchemaVersion: 99,
      value: familyValue,
      displayName: "Forward catalog",
      faces: [{ fileHash, futureFaceMetadata: true }]
    }
  ]
  const rawSiteProfiles = [
    { pattern: "https://example.com/*", font: familyValue }
  ]
  const blobKey = `${CUSTOM_FONT_FACE_STORAGE_PREFIX}${fileHash}`
  const rawBlob = { futureBlobEncoding: "opaque", payload: "keep-me" }
  const localValues: Record<string, unknown> = {
    [CUSTOM_FONT_STORAGE_SCHEMA_VERSION_KEY]:
      CUSTOM_FONT_STORAGE_SCHEMA_VERSION,
    [STORAGE_KEYS.CUSTOM_FONT_LIST]: structuredClone(rawCatalog),
    [STORAGE_KEYS.SELECTED_FONT]: familyValue,
    [STORAGE_KEYS.SITE_PROFILES]: structuredClone(rawSiteProfiles),
    [STORAGE_KEYS.SYNC_SETTINGS]: false,
    [STORAGE_KEYS.UI_LANGUAGE]: "auto",
    [blobKey]: structuredClone(rawBlob)
  }
  const syncValues: Record<string, unknown> = {}
  installChromeRuntimeMock(localValues, syncValues)

  const imported = await ExtensionRuntime.importSettings({
    [STORAGE_KEYS.SYNC_SETTINGS]: false,
    [STORAGE_KEYS.UI_LANGUAGE]: "fa"
  })

  assert.equal(imported.importedKeyCount, 2)
  assert.equal(localValues[STORAGE_KEYS.UI_LANGUAGE], "fa")
  assert.deepEqual(localValues[STORAGE_KEYS.CUSTOM_FONT_LIST], rawCatalog)
  assert.equal(localValues[STORAGE_KEYS.SELECTED_FONT], familyValue)
  assert.deepEqual(localValues[STORAGE_KEYS.SITE_PROFILES], rawSiteProfiles)
  assert.deepEqual(localValues[blobKey], rawBlob)

  await assert.rejects(
    ExtensionRuntime.importSettings({
      [STORAGE_KEYS.CUSTOM_FONT_LIST]: null
    }),
    /invalid-custom-font-backup/
  )
  assert.deepEqual(localValues[STORAGE_KEYS.CUSTOM_FONT_LIST], rawCatalog)
  assert.deepEqual(localValues[blobKey], rawBlob)

  // Let the deferred change report finish against this test's chrome mock.
  await new Promise((resolve) => setTimeout(resolve, 40))
})

test("a delayed local change publishes settings and revision from the same snapshot", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.DISABLED_FOR]: ["example.com"],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: true,
    [STORAGE_KEYS.SYNC_SETTINGS]: false
  }
  installChromeRuntimeMock(localValues, {})
  await ExtensionRuntime.start()
  await getBackgroundSettings()

  const published: Array<{
    settings: Record<string, unknown>
    revision: number
  }> = []
  const originalPublish = Reflect.get(ExtensionRuntime, "publishSettingsChange")
  Reflect.set(
    ExtensionRuntime,
    "publishSettingsChange",
    async (settings: Record<string, unknown>, revision: number) => {
      published.push({ settings, revision })
    }
  )
  let laterMutation: Promise<Record<string, unknown>> | undefined
  const originalSet = chrome.storage.local.set
  chrome.storage.local.set = ((
    items: Record<string, unknown>,
    callback: () => void
  ) => {
    if (
      !laterMutation &&
      Object.keys(items).length === 1 &&
      FONTARA_SETTINGS_REVISION_KEY in items
    ) {
      // The first event reconciles an enabled site. Before its publisher reads
      // the revision, a newer UI mutation excludes that site again.
      laterMutation = writeBackgroundSettings({
        [STORAGE_KEYS.DISABLED_FOR]: ["example.com"]
      })
    }
    originalSet(items, callback)
  }) as typeof chrome.storage.local.set

  try {
    localValues[STORAGE_KEYS.DISABLED_FOR] = []
    const handleChange = Reflect.get(
      ExtensionRuntime,
      "handleLocalSettingsChange"
    ) as (
      changes: Record<string, chrome.storage.StorageChange>
    ) => Promise<void>
    await handleChange({
      [STORAGE_KEYS.DISABLED_FOR]: { newValue: [], oldValue: ["example.com"] }
    })
    assert.ok(laterMutation)
    await laterMutation
    assert.equal(published.length, 1)
    assert.equal(
      published[0].revision,
      localValues[FONTARA_SETTINGS_REVISION_KEY]
    )
    assert.deepEqual(published[0].settings[STORAGE_KEYS.DISABLED_FOR], [
      "example.com"
    ])
  } finally {
    Reflect.set(ExtensionRuntime, "publishSettingsChange", originalPublish)
  }
})

test("a stale Google Fonts disable event restores the latest network preference", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: true,
    [STORAGE_KEYS.SYNC_SETTINGS]: false,
    [FONTARA_SETTINGS_REVISION_KEY]: 3
  }
  installChromeRuntimeMock(localValues, {})
  await ExtensionRuntime.start()
  await getBackgroundSettings()

  const networkActions: string[] = []
  const managerPrototype = BackgroundGoogleFontManager.prototype
  const originalCancel = managerPrototype.cancelPendingNetwork
  const originalResume = managerPrototype.resumeNetwork
  managerPrototype.cancelPendingNetwork = () => {
    networkActions.push("cancel")
  }
  managerPrototype.resumeNetwork = () => {
    networkActions.push("resume")
  }

  try {
    const handleChange = Reflect.get(
      ExtensionRuntime,
      "handleLocalSettingsChange"
    ) as (
      changes: Record<string, chrome.storage.StorageChange>
    ) => Promise<void>
    await handleChange({
      [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: { newValue: false, oldValue: true },
      [FONTARA_SETTINGS_REVISION_KEY]: { newValue: 2, oldValue: 1 }
    })

    // Stop immediately for an opt-out event, then reconcile the newer opt-in.
    // The stale event is ignored by the cache but must not leave network paused.
    assert.deepEqual(networkActions, ["cancel", "resume"])
    assert.equal(
      (await getBackgroundSettings())[STORAGE_KEYS.GOOGLE_FONTS_ENABLED],
      true
    )
  } finally {
    managerPrototype.cancelPendingNetwork = originalCancel
    managerPrototype.resumeNetwork = originalResume
  }
})
