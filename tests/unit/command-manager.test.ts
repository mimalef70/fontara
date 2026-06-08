import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  runFontaraCommand,
  setFontaraCommandRunner
} from "../../src/background/command-manager"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  setFontaraCommandRunner(null)
  Reflect.set(globalThis, "chrome", originalChrome)
})

test("FontAra commands are ignored until the runtime runner is registered", async () => {
  await assert.doesNotReject(() => runFontaraCommand("toggle"))
})

test("FontAra commands delegate to the runtime when a runner is registered", async () => {
  const calls: Array<{ command: string; tabId?: number; url?: string | null }> =
    []

  setFontaraCommandRunner(async (command, details) => {
    calls.push({
      command,
      tabId: details?.tab?.id,
      url: details?.url
    })
  })

  await runFontaraCommand("addSite", {
    tab: { id: 1, url: "https://tab.example/path" } as chrome.tabs.Tab,
    url: "https://example.com/path"
  })

  assert.deepEqual(calls, [
    {
      command: "addSite",
      tabId: 1,
      url: "https://example.com/path"
    }
  ])
})
