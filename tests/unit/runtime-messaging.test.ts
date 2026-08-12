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
const originalTest = Reflect.get(globalThis, "__TEST__") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__DEBUG__", originalDebug)
  Reflect.set(globalThis, "__TEST__", originalTest)
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
      id: 1,
      isActive: true,
      isSupported: true,
      url: "https://example.com"
    },
    isReady: true,
    settings: {
      selectedFont: "Vazirmatn-Fontara"
    },
    settingsRevision: 1,
    shortcuts: {
      toggle: "Alt+Shift+F"
    }
  }
  const changedSettings: unknown[] = []
  const begunFontTransactions: unknown[] = []

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
    async abortCustomFontTransaction() {},
    async beginCustomFontTransaction(family, mode) {
      begunFontTransactions.push({ family, mode })
      return { expiresAt: 1, transactionId: "replacement-transaction" }
    },
    async changeSettings(settings) {
      changedSettings.push(settings)
      return { revision: 2 }
    },
    async collect() {
      return extensionData
    },
    async importSettings(settings) {
      changedSettings.push(settings)
      return {
        ignoredKeyCount: 0,
        importedKeyCount: Object.keys(settings).length,
        revision: 3
      }
    },
    async commitCustomFontTransaction() {
      throw new Error("unused")
    },
    async deleteCustomFont() {
      return { revision: 4 }
    },
    async importCustomFontBatch() {
      throw new Error("unused")
    },
    async putCustomFontFace() {},
    async resetSettings() {
      return { revision: 5 }
    },
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
      data: {
        clientMutationId: "mutation-font-begin",
        family: { value: "Imported-Fontara" },
        mode: "replace-library"
      },
      type: MESSAGE_TYPES_UI_TO_BG.CUSTOM_FONT_BEGIN
    },
    allowedSender,
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.deepEqual(begunFontTransactions, [
    {
      family: { value: "Imported-Fontara" },
      mode: "replace-library"
    }
  ])
  assert.deepEqual(response, {
    data: { expiresAt: 1, transactionId: "replacement-transaction" }
  })

  listeners[0](
    {
      data: {
        clientMutationId: "mutation-1",
        settings: { selectedFont: "Estedad-Fontara" }
      },
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    },
    allowedSender,
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.deepEqual(changedSettings, [{ selectedFont: "Estedad-Fontara" }])
  assert.deepEqual(response, { data: { revision: 2 } })

  listeners[0](
    {
      data: {
        clientMutationId: "mutation-1",
        settings: { selectedFont: "Must-Not-Run-Twice-Fontara" }
      },
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    },
    allowedSender,
    (nextResponse) => {
      response = nextResponse
    }
  )
  await waitForMessageResponse()

  assert.deepEqual(changedSettings, [{ selectedFont: "Estedad-Fontara" }])
  assert.deepEqual(response, { data: { revision: 2 } })

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
      data: {
        clientMutationId: "mutation-2",
        settings: { selectedFont: "Ignored-Fontara" }
      },
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
  Reflect.set(globalThis, "__TEST__", false)
  const disabledBridgeHandled = listeners[0](
    createFontaraBrowserTestRelayMessage({
      data: {
        clientMutationId: "mutation-3",
        settings: { selectedFont: "Ignored-Bridge-Fontara" }
      },
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
  Reflect.set(globalThis, "__TEST__", true)
  const enabledBridgeHandled = listeners[0](
    createFontaraBrowserTestRelayMessage({
      data: {
        clientMutationId: "mutation-4",
        settings: { selectedFont: "Bridge-Fontara" }
      },
      type: MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS
    }),
    {
      tab: { id: 2 } as chrome.tabs.Tab,
      url: "http://127.0.0.1:4317/page"
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
  assert.deepEqual(response, { data: { revision: 2 } })
})
