import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { openOptionsPageSafely } from "../../src/utils/options-page"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

test("openOptionsPageSafely uses the native options page API when available", async () => {
  let nativeCalls = 0
  let fallbackCalls = 0

  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      },
      async openOptionsPage() {
        nativeCalls += 1
      }
    },
    tabs: {
      async create() {
        fallbackCalls += 1
      }
    }
  })

  await openOptionsPageSafely()

  assert.equal(nativeCalls, 1)
  assert.equal(fallbackCalls, 0)
})

test("openOptionsPageSafely falls back to the options URL when native open fails", async () => {
  let fallbackUrl = ""

  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      },
      async openOptionsPage() {
        throw new Error("Could not create an options page.")
      }
    },
    tabs: {
      async create(options: chrome.tabs.CreateProperties) {
        fallbackUrl = options.url || ""
      }
    }
  })

  await assert.doesNotReject(openOptionsPageSafely)
  assert.equal(fallbackUrl, "chrome-extension://fontara/ui/options/index.html")
})

test("openOptionsPageSafely does not leak fallback failures", async () => {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      },
      async openOptionsPage() {
        throw new Error("Could not create an options page.")
      }
    },
    tabs: {
      async create() {
        throw new Error("Could not create a tab.")
      }
    }
  })

  await assert.doesNotReject(openOptionsPageSafely)
})
