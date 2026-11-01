import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  getBackgroundSettings,
  resetBackgroundSettingsCacheForTesting,
  writeBackgroundSettings
} from "../../src/background/settings-manager"
import { registerSettingsSyncListeners } from "../../src/background/storage-manager"
import { STORAGE_KEYS } from "../../src/config/storage"
import { FONTARA_SETTINGS_UPDATED_AT_KEY } from "../../src/utils/settings-sync"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  resetBackgroundSettingsCacheForTesting()
  Reflect.set(globalThis, "chrome", originalChrome)
})

test("a local mutation waits for the incoming sync merge and remains the final choice", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara",
    [STORAGE_KEYS.SYNC_SETTINGS]: true,
    [FONTARA_SETTINGS_UPDATED_AT_KEY]: 1
  }
  const syncValues = {
    [STORAGE_KEYS.SELECTED_FONT]: "Estedad-Fontara",
    [STORAGE_KEYS.SYNC_SETTINGS]: true,
    [FONTARA_SETTINGS_UPDATED_AT_KEY]: 2
  }
  const writtenFonts: unknown[] = []
  let storageListener:
    | ((
        changes: Record<string, chrome.storage.StorageChange>,
        area: string
      ) => void)
    | undefined
  let localReadCount = 0
  let finishSyncPreflight: (() => void) | undefined
  let signalPreflight: (() => void) | undefined
  const preflightReached = new Promise<void>((resolve) => {
    signalPreflight = resolve
  })

  Reflect.set(globalThis, "chrome", {
    runtime: {},
    storage: {
      onChanged: {
        addListener(listener: typeof storageListener) {
          storageListener = listener
        }
      },
      local: {
        get(
          defaults: Record<string, unknown>,
          callback: (values: Record<string, unknown>) => void
        ) {
          localReadCount += 1
          const snapshot = { ...defaults, ...localValues }
          if (localReadCount === 2) {
            finishSyncPreflight = () => callback(snapshot)
            signalPreflight?.()
            return
          }
          callback(snapshot)
        },
        set(values: Record<string, unknown>, callback: () => void) {
          Object.assign(localValues, values)
          if (STORAGE_KEYS.SELECTED_FONT in values) {
            writtenFonts.push(values[STORAGE_KEYS.SELECTED_FONT])
          }
          callback()
        }
      },
      sync: {
        get(_keys: unknown, callback: (values: typeof syncValues) => void) {
          callback(syncValues)
        }
      }
    }
  })

  registerSettingsSyncListeners()
  assert.ok(storageListener)
  storageListener(
    { [STORAGE_KEYS.SELECTED_FONT]: { newValue: "Estedad-Fontara" } },
    "sync"
  )
  await preflightReached
  let mutationFinished = false
  const mutation = writeBackgroundSettings({
    [STORAGE_KEYS.SELECTED_FONT]: "Sahel-Fontara"
  }).then(() => {
    mutationFinished = true
  })

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(mutationFinished, false)
  assert.deepEqual(writtenFonts, [])
  assert.ok(finishSyncPreflight)
  finishSyncPreflight()
  await mutation

  assert.deepEqual(writtenFonts, ["Estedad-Fontara", "Sahel-Fontara"])
  assert.equal(localValues[STORAGE_KEYS.SELECTED_FONT], "Sahel-Fontara")
  assert.ok(Number(localValues[FONTARA_SETTINGS_UPDATED_AT_KEY]) > 2)
  assert.equal(
    (await getBackgroundSettings())[STORAGE_KEYS.SELECTED_FONT],
    "Sahel-Fontara"
  )
})
