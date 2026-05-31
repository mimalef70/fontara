import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  getLocalBytesInUse,
  getLocalValue,
  getLocalValues,
  setLocalValue
} from "../../src/utils/storage"

const originalChrome = (globalThis as any).chrome

afterEach(() => {
  ;(globalThis as any).chrome = originalChrome
})

function mockChromeStorage(options: {
  bytesError?: string
  getError?: string
  setError?: string
  values?: Record<string, unknown>
}): Record<string, unknown> {
  const values = { ...(options.values || {}) }
  let runtimeError: { message: string } | undefined
  ;(globalThis as any).chrome = {
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
  }

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
