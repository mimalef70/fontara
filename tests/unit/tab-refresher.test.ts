import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  canRefreshTab,
  isInjectableTabUrl,
  refreshOpenTabs
} from "../../src/background/tab-refresher"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

type FileInjection = {
  files?: string[]
  target: chrome.scripting.InjectionTarget
}

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

test("tab refresher only targets injectable web URLs", () => {
  assert.equal(isInjectableTabUrl("https://example.com"), true)
  assert.equal(isInjectableTabUrl("http://example.com"), true)
  assert.equal(isInjectableTabUrl("chrome://extensions"), false)
  assert.equal(isInjectableTabUrl("about:blank"), false)
  assert.equal(isInjectableTabUrl("file:///tmp/page.html"), false)
  assert.equal(isInjectableTabUrl(undefined), false)

  assert.equal(
    canRefreshTab({ id: 1, url: "https://example.com" } as chrome.tabs.Tab),
    true
  )
  assert.equal(
    canRefreshTab({ url: "https://example.com" } as chrome.tabs.Tab),
    false
  )
})

test("refreshOpenTabs reinjects FontAra into open web tabs", async () => {
  const injectedTargets: Array<chrome.scripting.InjectionTarget> = []
  const injectedFiles: Array<string[] | undefined> = []

  Reflect.set(globalThis, "chrome", {
    scripting: {
      async executeScript(injection: FileInjection) {
        injectedTargets.push(injection.target)
        injectedFiles.push(injection.files)

        if (injection.target.tabId === 3) {
          throw new Error("Cannot access tab")
        }

        return []
      }
    },
    tabs: {
      async query(queryInfo: chrome.tabs.QueryInfo) {
        assert.deepEqual(queryInfo, {})
        return [
          { id: 1, url: "https://example.com" },
          { id: 2, url: "chrome://extensions" },
          { id: 3, url: "http://example.org" },
          { id: 4 },
          { id: 5, url: "file:///tmp/page.html" }
        ] as chrome.tabs.Tab[]
      }
    }
  })

  await refreshOpenTabs()

  assert.deepEqual(injectedTargets, [
    { tabId: 1, allFrames: true },
    { tabId: 3, allFrames: true }
  ])
  assert.deepEqual(injectedFiles, [["inject/index.js"], ["inject/index.js"]])
})
