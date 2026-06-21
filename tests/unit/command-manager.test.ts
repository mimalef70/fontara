import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  registerCommandListeners,
  resetCommandManagerStateForTesting,
  runFontaraCommand,
  setFontaraCommandRunner
} from "../../src/background/command-manager"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
type CommandListener = (command: string, tab?: chrome.tabs.Tab) => void

afterEach(() => {
  resetCommandManagerStateForTesting()
  Reflect.set(globalThis, "chrome", originalChrome)
})

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

test("FontAra command debounce keeps different commands independent", async () => {
  const commandListenerRef: { current: CommandListener | null } = {
    current: null
  }
  const calls: Array<{ command: string; tabId?: number }> = []

  Reflect.set(globalThis, "chrome", {
    commands: {
      onCommand: {
        addListener(listener: CommandListener) {
          commandListenerRef.current = listener
        }
      }
    }
  })
  setFontaraCommandRunner(async (command, details) => {
    calls.push({
      command,
      tabId: details?.tab?.id
    })
  })

  registerCommandListeners()
  const listener = commandListenerRef.current
  if (!listener) throw new Error("command-listener-missing")
  listener("toggle", { id: 1 } as chrome.tabs.Tab)
  await wait(10)
  listener("addSite", { id: 1 } as chrome.tabs.Tab)
  await wait(100)

  assert.deepEqual(calls, [
    {
      command: "toggle",
      tabId: 1
    },
    {
      command: "addSite",
      tabId: 1
    }
  ])
})

test("FontAra command debounce keeps only the latest repeat of one command", async () => {
  const commandListenerRef: { current: CommandListener | null } = {
    current: null
  }
  const calls: Array<{ command: string; tabId?: number }> = []

  Reflect.set(globalThis, "chrome", {
    commands: {
      onCommand: {
        addListener(listener: CommandListener) {
          commandListenerRef.current = listener
        }
      }
    }
  })
  setFontaraCommandRunner(async (command, details) => {
    calls.push({
      command,
      tabId: details?.tab?.id
    })
  })

  registerCommandListeners()
  const listener = commandListenerRef.current
  if (!listener) throw new Error("command-listener-missing")
  listener("toggle", { id: 1 } as chrome.tabs.Tab)
  await wait(10)
  listener("toggle", { id: 2 } as chrome.tabs.Tab)
  await wait(100)

  assert.deepEqual(calls, [
    {
      command: "toggle",
      tabId: 2
    }
  ])
})
