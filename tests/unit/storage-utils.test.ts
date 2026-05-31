import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  getLocalBytesInUse,
  getLocalValue,
  getLocalValues,
  setLocalValue,
  watchLocalStorage
} from "../../src/utils/storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

function mockChromeStorage(options: {
  bytesError?: string
  getError?: string
  setError?: string
  values?: Record<string, unknown>
}): Record<string, unknown> {
  const values = { ...(options.values || {}) }
  let runtimeError: { message: string } | undefined
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return runtimeError
      }
    },
    storage: {
      local: {
        get(
          keys: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          runtimeError = options.getError
            ? { message: options.getError }
            : undefined

          if (typeof keys === "string") {
            callback({ [keys]: values[keys] })
          } else {
            callback({ ...keys, ...values })
          }

          runtimeError = undefined
        },
        set(items: Record<string, unknown>, callback: () => void) {
          runtimeError = options.setError
            ? { message: options.setError }
            : undefined

          if (!runtimeError) {
            Object.assign(values, items)
          }

          callback()
          runtimeError = undefined
        },
        getBytesInUse(
          _keys: string | string[] | null,
          callback: (bytesInUse: number) => void
        ) {
          runtimeError = options.bytesError
            ? { message: options.bytesError }
            : undefined

          callback(128)
          runtimeError = undefined
        }
      }
    }
  })

  return values
}

test("storage helpers resolve values when chrome storage succeeds", async () => {
  const values = mockChromeStorage({
    values: {
      enabled: true
    }
  })

  assert.equal(await getLocalValue("enabled"), true)
  assert.deepEqual(await getLocalValues({ enabled: false, font: "default" }), {
    enabled: true,
    font: "default"
  })

  await setLocalValue("font", "Vazirmatn-Fontara")
  assert.equal(values.font, "Vazirmatn-Fontara")
  assert.equal(await getLocalBytesInUse(), 128)
})

test("storage helpers reject chrome runtime errors", async () => {
  mockChromeStorage({ getError: "read failed" })
  await assert.rejects(() => getLocalValue("enabled"), /read failed/)

  mockChromeStorage({ setError: "quota exceeded" })
  await assert.rejects(() => setLocalValue("font", "data"), /quota exceeded/)

  mockChromeStorage({ bytesError: "bytes failed" })
  await assert.rejects(() => getLocalBytesInUse(), /bytes failed/)
})

test("watchLocalStorage dispatches local changes and removes its listener", () => {
  type StorageListener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: "sync" | "local" | "managed" | "session"
  ) => void

  const listeners: StorageListener[] = []
  let removed = false
  let seenValue: unknown
  Reflect.set(globalThis, "chrome", {
    storage: {
      onChanged: {
        addListener(callback: StorageListener) {
          listeners.push(callback)
        },
        removeListener(callback: StorageListener) {
          removed = listeners.includes(callback)
        }
      }
    }
  })

  const stop = watchLocalStorage({
    selectedFont: (change) => {
      seenValue = change.newValue
    }
  })

  const dispatchStorageChange = listeners[0]
  dispatchStorageChange(
    { selectedFont: { newValue: "Vazirmatn-Fontara" } },
    "local"
  )
  dispatchStorageChange(
    { selectedFont: { newValue: "Ignored-Fontara" } },
    "sync"
  )
  stop()

  assert.equal(seenValue, "Vazirmatn-Fontara")
  assert.equal(removed, true)
})

test("watchLocalStorage returns safe cleanup when registration fails", () => {
  let addCalls = 0

  Reflect.set(globalThis, "chrome", {
    storage: {
      onChanged: {
        addListener() {
          addCalls += 1
          throw new Error("Extension context invalidated.")
        },
        removeListener() {
          throw new Error("Should not remove an unregistered listener.")
        }
      }
    }
  })

  const stop = watchLocalStorage({})

  assert.equal(addCalls, 1)
  assert.doesNotThrow(stop)
})
