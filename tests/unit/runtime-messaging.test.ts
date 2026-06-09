import assert from "node:assert/strict"
import test, { afterEach } from "node:test"
import { initMessenger, reportChanges } from "../../src/background/messenger"
import type { FontaraExtensionData } from "../../src/definitions"
import { createFontaraBrowserTestRelayMessage } from "../../src/utils/browser-test-bridge"
import {
  MESSAGE_TYPES_BG_TO_UI,
  MESSAGE_TYPES_UI_TO_BG
} from "../../src/utils/message"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalDebug = Reflect.get(globalThis, "__DEBUG__") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__DEBUG__", originalDebug)
})

function waitForMessageResponse(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const allowedSender: chrome.runtime.MessageSender = {
  url: "chrome-extension://fontara/ui/options/index.html"
}

test("background messenger routes UI requests and reports subscribed changes", async () => {
  const listeners: Array<
    (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => boolean
  > = []
  const sentMessages: unknown[] = []
  const extensionData: FontaraExtensionData = {
    activeTab: {
      favIconUrl: "https://example.com/favicon.ico",
      id: 1,
      isActive: true,
      isSupported: true,
      url: "https://example.com"
    },
    isReady: true,
    settings: {
      selectedFont: "Vazirmatn-Fontara"
    },
    shortcuts: {
      toggle: "Alt+Shift+F"
    }
  }
  const changedSettings: unknown[] = []

  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL(path: string) {
        return `chrome-extension://fontara/${path}`
      },
      onMessage: {
        addListener(listener: (typeof listeners)[number]) {
          listeners.push(listener)
        }
      },
      sendMessage(message: unknown) {
        sentMessages.push(message)
      }
    }
  })

  initMessenger({
    async changeSettings(settings) {
      changedSettings.push(settings)
    },
    async collect() {
      return extensionData
    },
    async importSettings(settings) {
      changedSettings.push(settings)
      return {
        ignoredKeyCount: 0,
        importedKeyCount: Object.keys(settings).length
      }
    },
    async resetSettings() {},
    async runCommand() {}
  })

  assert.equal(listeners.length, 1)

  let response: unknown
  listeners[0](
    { type: MESSAGE_TYPES_UI_TO_BG.GET_DATA },
    allowedSender,
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.deepEqual(response, { data: extensionData })

  listeners[0](
    {
      data: { selectedFont: "Estedad-Fontara" },
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    },
    allowedSender,
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.deepEqual(changedSettings, [{ selectedFont: "Estedad-Fontara" }])
  assert.deepEqual(response, { data: true })

  listeners[0](
    { type: MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES },
    allowedSender,
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.deepEqual(response, { data: extensionData })

  reportChanges(extensionData)

  assert.deepEqual(sentMessages, [
    {
      data: extensionData,
      type: MESSAGE_TYPES_BG_TO_UI.CHANGES
    }
  ])

  const handled = listeners[0](
    {
      data: { selectedFont: "Ignored-Fontara" },
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    },
    { url: "https://example.com/page" },
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.equal(handled, false)
  assert.deepEqual(changedSettings, [{ selectedFont: "Estedad-Fontara" }])

  response = undefined
  Reflect.set(globalThis, "__DEBUG__", false)
  const disabledBridgeHandled = listeners[0](
    createFontaraBrowserTestRelayMessage({
      data: { selectedFont: "Ignored-Bridge-Fontara" },
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    }),
    {
      tab: { id: 2 } as chrome.tabs.Tab,
      url: "https://example.com/page"
    },
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.equal(disabledBridgeHandled, false)
  assert.equal(response, undefined)
  assert.deepEqual(changedSettings, [{ selectedFont: "Estedad-Fontara" }])

  Reflect.set(globalThis, "__DEBUG__", true)
  const enabledBridgeHandled = listeners[0](
    createFontaraBrowserTestRelayMessage({
      data: { selectedFont: "Bridge-Fontara" },
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    }),
    {
      tab: { id: 2 } as chrome.tabs.Tab,
      url: "https://example.com/page"
    },
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.equal(enabledBridgeHandled, true)
  assert.deepEqual(changedSettings, [
    { selectedFont: "Estedad-Fontara" },
    { selectedFont: "Bridge-Fontara" }
  ])
  assert.deepEqual(response, { data: true })
})
