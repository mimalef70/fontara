import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"

import {
  getBackgroundSettings,
  resetBackgroundSettingsCacheForTesting,
  syncBackgroundSettingsCacheFromLocalChanges,
  writeBackgroundSettings
} from "../../src/background/settings-manager"
import { STORAGE_KEYS } from "../../src/config/storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

beforeEach(() => {
  resetBackgroundSettingsCacheForTesting()
})

afterEach(() => {
  resetBackgroundSettingsCacheForTesting()
  Reflect.set(globalThis, "chrome", originalChrome)
})

function installChromeStorageMock(initialValues: Record<string, unknown>): {
  getReadCount: () => number
  getSetCalls: () => Array<Record<string, unknown>>
  localValues: Record<string, unknown>
} {
  const localValues = { ...initialValues }
  const setCalls: Array<Record<string, unknown>> = []
  let readCount = 0

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      }
    },
    storage: {
      local: {
        get(
          keys: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          readCount += 1
          if (typeof keys === "string") {
            callback({ [keys]: localValues[keys] })
            return
          }

          callback({ ...keys, ...localValues })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          setCalls.push(items)
          Object.assign(localValues, items)
          callback()
        }
      }
    }
  })

  return {
    getReadCount: () => readCount,
    getSetCalls: () => setCalls,
    localValues
  }
}

test("background settings manager caches normalized settings snapshots", async () => {
  const storage = installChromeStorageMock({
    [STORAGE_KEYS.SELECTED_FONT]: "Estedad-Fontara"
  })

  const firstSettings = await getBackgroundSettings()
  const secondSettings = await getBackgroundSettings()

  assert.equal(storage.getReadCount(), 1)
  assert.equal(firstSettings, secondSettings)
  assert.equal(firstSettings[STORAGE_KEYS.SELECTED_FONT], "Estedad-Fontara")
})

test("background settings manager writes only changed normalized values", async () => {
  const storage = installChromeStorageMock({
    [STORAGE_KEYS.SELECTED_FONT]: "Estedad-Fontara"
  })

  await getBackgroundSettings()
  const nextSettings = await writeBackgroundSettings({
    [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara"
  })
  const cachedSettings = await getBackgroundSettings()

  assert.equal(storage.getReadCount(), 1)
  assert.deepEqual(storage.getSetCalls(), [
    {
      [STORAGE_KEYS.SELECTED_FONT]: "Vazirmatn-Fontara"
    }
  ])
  assert.equal(
    storage.localValues[STORAGE_KEYS.SELECTED_FONT],
    "Vazirmatn-Fontara"
  )
  assert.equal(nextSettings, cachedSettings)
})

test("background settings manager patches cache from local storage changes", async () => {
  const storage = installChromeStorageMock({
    [STORAGE_KEYS.SELECTED_FONT]: "Estedad-Fontara"
  })

  await getBackgroundSettings()
  await syncBackgroundSettingsCacheFromLocalChanges({
    [STORAGE_KEYS.SELECTED_FONT]: {
      newValue: "Vazirmatn-Fontara",
      oldValue: "Estedad-Fontara"
    }
  })
  const cachedSettings = await getBackgroundSettings()

  assert.equal(storage.getReadCount(), 1)
  assert.equal(cachedSettings[STORAGE_KEYS.SELECTED_FONT], "Vazirmatn-Fontara")
})
