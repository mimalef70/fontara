import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  getTrackedDocumentCountForTesting,
  initTabManager,
  notifyContentScriptsAboutSettingsChange
} from "../../src/background/tab-manager"
import {
  MESSAGE_TYPES_BG_TO_CS,
  MESSAGE_TYPES_CS_TO_BG
} from "../../src/utils/message"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
})

test("tab manager tracks content documents and notifies them about settings changes", () => {
  const runtimeMessageListeners: Array<
    (message: unknown, sender: chrome.runtime.MessageSender) => boolean
  > = []
  const removedTabListeners: Array<(tabId: number) => void> = []
  const sentMessages: Array<{
    message: unknown
    options?: chrome.tabs.MessageSendOptions
    tabId: number
  }> = []
  let runtimeLastError: { message?: string } | undefined

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return runtimeLastError
      },
      onMessage: {
        addListener(listener: (typeof runtimeMessageListeners)[number]) {
          runtimeMessageListeners.push(listener)
        }
      }
    },
    tabs: {
      onRemoved: {
        addListener(listener: (tabId: number) => void) {
          removedTabListeners.push(listener)
        }
      },
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void
      ) {
        const tabs = [
          { id: 9, url: "https://lost.example/" } as chrome.tabs.Tab,
          { id: 10, url: "http://other.example/" } as chrome.tabs.Tab,
          { id: 11, url: "chrome://extensions/" } as chrome.tabs.Tab,
          { url: "https://missing-id.example/" } as chrome.tabs.Tab
        ]
        callback?.(tabs)
        return Promise.resolve(tabs)
      },
      sendMessage(
        tabId: number,
        message: unknown,
        optionsOrCallback?: chrome.tabs.MessageSendOptions | (() => void),
        callback?: () => void
      ) {
        const options =
          typeof optionsOrCallback === "function"
            ? undefined
            : optionsOrCallback
        const sendResponse =
          typeof optionsOrCallback === "function" ? optionsOrCallback : callback

        sentMessages.push({ message, options, tabId })
        if (options?.documentId === "doc-fallback" && !options.frameId) {
          runtimeLastError = { message: "No receiving end" }
          sendResponse?.()
          runtimeLastError = undefined
          return
        }

        runtimeLastError = undefined
        sendResponse?.()
      }
    }
  })

  initTabManager()

  assert.equal(runtimeMessageListeners.length, 1)

  notifyContentScriptsAboutSettingsChange()

  assert.deepEqual(sentMessages, [
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 9
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 10
    }
  ])

  sentMessages.length = 0

  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: false,
        url: "https://example.com/frame"
      },
      scriptId: "script-1",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "doc-1",
      frameId: 2,
      tab: { id: 7 } as chrome.tabs.Tab
    }
  )

  assert.equal(getTrackedDocumentCountForTesting(), 1)

  notifyContentScriptsAboutSettingsChange()

  assert.deepEqual(sentMessages, [
    {
      message: {
        scriptId: "script-1",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { documentId: "doc-1" },
      tabId: 7
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 9
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 10
    }
  ])

  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: false,
        url: "https://example.com/frame"
      },
      scriptId: "script-1",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET
    },
    {
      documentId: "doc-1",
      frameId: 2,
      tab: { id: 7 } as chrome.tabs.Tab
    }
  )

  assert.equal(getTrackedDocumentCountForTesting(), 0)

  sentMessages.length = 0
  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: false,
        url: "https://example.com/fallback-frame"
      },
      scriptId: "script-fallback",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "doc-fallback",
      frameId: 3,
      tab: { id: 7 } as chrome.tabs.Tab
    }
  )

  notifyContentScriptsAboutSettingsChange()

  assert.deepEqual(sentMessages, [
    {
      message: {
        scriptId: "script-fallback",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { documentId: "doc-fallback" },
      tabId: 7
    },
    {
      message: {
        scriptId: "script-fallback",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { documentId: "doc-fallback", frameId: 3 },
      tabId: 7
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 9
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 10
    }
  ])

  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: false,
        url: "https://example.com/fallback-frame"
      },
      scriptId: "script-fallback",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET
    },
    {
      documentId: "doc-fallback",
      frameId: 3,
      tab: { id: 7 } as chrome.tabs.Tab
    }
  )

  assert.equal(getTrackedDocumentCountForTesting(), 0)

  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: true,
        url: "https://example.com"
      },
      scriptId: "script-2",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      frameId: 0,
      tab: { id: 7 } as chrome.tabs.Tab
    }
  )
  removedTabListeners[0](7)

  assert.equal(getTrackedDocumentCountForTesting(), 0)

  sentMessages.length = 0
  initTabManager({
    createDocumentMessage: (document) => ({
      data: {
        font: {
          active: false,
          applyMode: "full",
          customCSS: null,
          customFontCSS: "",
          fontFaceCSS: "",
          fontName: "Vazirmatn-Fontara",
          googleFontCSS: null,
          textStrokeCSS: ""
        },
        rtl: {
          active: document.url.includes("chatgpt.com"),
          siteId: document.url.includes("chatgpt.com") ? "chatgpt" : null
        }
      },
      type: MESSAGE_TYPES_BG_TO_CS.APPLY_THEME
    })
  })

  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: true,
        url: "https://chatgpt.com/"
      },
      scriptId: "script-command",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      frameId: 0,
      tab: { id: 8 } as chrome.tabs.Tab
    }
  )

  assert.deepEqual(sentMessages, [
    {
      message: {
        data: {
          font: {
            active: false,
            applyMode: "full",
            customCSS: null,
            customFontCSS: "",
            fontFaceCSS: "",
            fontName: "Vazirmatn-Fontara",
            googleFontCSS: null,
            textStrokeCSS: ""
          },
          rtl: {
            active: true,
            siteId: "chatgpt"
          }
        },
        scriptId: "script-command",
        type: MESSAGE_TYPES_BG_TO_CS.APPLY_THEME
      },
      options: { frameId: 0 },
      tabId: 8
    }
  ])

  sentMessages.length = 0
  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: true,
        url: "https://example.com/inactive"
      },
      scriptId: "script-command",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE
    },
    {
      frameId: 0,
      tab: { id: 8 } as chrome.tabs.Tab
    }
  )

  assert.deepEqual(sentMessages, [
    {
      message: {
        data: {
          font: {
            active: false,
            applyMode: "full",
            customCSS: null,
            customFontCSS: "",
            fontFaceCSS: "",
            fontName: "Vazirmatn-Fontara",
            googleFontCSS: null,
            textStrokeCSS: ""
          },
          rtl: {
            active: false,
            siteId: null
          }
        },
        scriptId: "script-command",
        type: MESSAGE_TYPES_BG_TO_CS.APPLY_THEME
      },
      options: { frameId: 0 },
      tabId: 8
    }
  ])

  sentMessages.length = 0
  notifyContentScriptsAboutSettingsChange((document) => ({
    scriptId: "ignored-script-id",
    type: document.url.includes("chatgpt.com")
      ? MESSAGE_TYPES_BG_TO_CS.CLEAN_UP
      : MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
  }))

  assert.deepEqual(sentMessages, [
    {
      message: {
        scriptId: "script-command",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { frameId: 0 },
      tabId: 8
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 9
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 10
    }
  ])

  removedTabListeners[0](8)
  assert.equal(getTrackedDocumentCountForTesting(), 0)
})
