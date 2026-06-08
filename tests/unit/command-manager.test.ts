import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  runFontaraCommand,
  setFontaraCommandRunner
} from "../../src/background/command-manager"
import { STORAGE_KEYS } from "../../src/config/storage"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  setFontaraCommandRunner(null)
  Reflect.set(globalThis, "chrome", originalChrome)
})

function installChromeStorageMock(localValues: Record<string, unknown>): void {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      }
    },
    storage: {
      local: {
        get(
          key: string | Record<string, unknown>,
          callback: (items: Record<string, unknown>) => void
        ) {
          if (typeof key === "string") {
            callback({ [key]: localValues[key] })
            return
          }

          callback({ ...key, ...localValues })
        },
        set(items: Record<string, unknown>, callback: () => void) {
          Object.assign(localValues, items)
          callback()
        }
      }
    },
    tabs: {
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void
      ) {
        callback([])
      }
    }
  })
}

test("FontAra commands toggle the extension globally", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.EXTENSION_ENABLED]: true
  }
  installChromeStorageMock(localValues)

  await runFontaraCommand("toggle")

  assert.equal(localValues[STORAGE_KEYS.EXTENSION_ENABLED], false)

  await runFontaraCommand("toggle")

  assert.equal(localValues[STORAGE_KEYS.EXTENSION_ENABLED], true)
})

test("FontAra commands toggle the current website", async () => {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.DISABLED_FOR]: [],
    [STORAGE_KEYS.ENABLED_BY_DEFAULT]: false,
    [STORAGE_KEYS.ENABLED_FOR]: [],
    [STORAGE_KEYS.WEBSITE_LIST]: []
  }
  installChromeStorageMock(localValues)

  await runFontaraCommand("addSite", {
    tab: { id: 1, url: "https://example.com/path" } as chrome.tabs.Tab
  })

  assert.deepEqual(localValues[STORAGE_KEYS.ENABLED_FOR], ["example.com"])
  assert.deepEqual(localValues[STORAGE_KEYS.DISABLED_FOR], [])
  assert.deepEqual(localValues[STORAGE_KEYS.WEBSITE_LIST], [
    {
      url: "https://example.com/path",
      regex: "^https?://example\\.com/?.*$",
      isActive: true
    }
  ])

  await runFontaraCommand("addSite", {
    tab: { id: 1, url: "https://example.com/path" } as chrome.tabs.Tab
  })

  assert.deepEqual(localValues[STORAGE_KEYS.ENABLED_FOR], [])
  assert.deepEqual(localValues[STORAGE_KEYS.WEBSITE_LIST], [
    {
      url: "https://example.com/path",
      regex: "^https?://example\\.com/?.*$",
      isActive: false
    }
  ])
})

test("FontAra commands delegate to the runtime when a runner is registered", async () => {
  const calls: Array<{ command: string; url?: string | null }> = []

  setFontaraCommandRunner(async (command, details) => {
    calls.push({
      command,
      url: details?.url
    })
  })

  await runFontaraCommand("addSite", { url: "https://example.com/path" })

  assert.deepEqual(calls, [
    {
      command: "addSite",
      url: "https://example.com/path"
    }
  ])
})
