import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { openOptionsPageSafely } from "../../src/utils/options-page"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalDebug = Reflect.get(globalThis, "__DEBUG__") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__DEBUG__", originalDebug)
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
  let warnCalls = 0
  const originalWarn = console.warn

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
  Reflect.set(globalThis, "__DEBUG__", true)
  console.warn = () => {
    warnCalls += 1
  }

  try {
    await assert.doesNotReject(openOptionsPageSafely)
    assert.equal(
      fallbackUrl,
      "chrome-extension://fontara/ui/options/index.html"
    )
    assert.equal(warnCalls, 0)
  } finally {
    console.warn = originalWarn
  }
})

test("openOptionsPageSafely opens targeted sections with a hash URL", async () => {
  let nativeCalls = 0
  let fallbackUrl = ""

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
      async create(options: chrome.tabs.CreateProperties) {
        fallbackUrl = options.url || ""
      }
    }
  })

  await openOptionsPageSafely({ section: "sites" })

  assert.equal(nativeCalls, 0)
  assert.equal(
    fallbackUrl,
    "chrome-extension://fontara/ui/options/index.html#sites"
  )
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
