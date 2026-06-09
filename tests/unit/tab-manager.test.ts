import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  getTrackedDocumentCountForTesting,
  initTabManager,
  notifyContentScriptsAboutSettingsChange,
  resetTabManagerStateForTesting,
  TAB_MANAGER_RUNTIME_STATE_KEY,
  TAB_MANAGER_RUNTIME_STATE_MAX_AGE_MS,
  TAB_MANAGER_RUNTIME_STATE_VERSION
} from "../../src/background/tab-manager"
import {
  MESSAGE_TYPES_BG_TO_CS,
  MESSAGE_TYPES_CS_TO_BG
} from "../../src/utils/message"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown

afterEach(() => {
  resetTabManagerStateForTesting()
  Reflect.set(globalThis, "chrome", originalChrome)
})

test("tab manager tracks content documents and notifies them about settings changes", async () => {
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

  await notifyContentScriptsAboutSettingsChange()

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

  await notifyContentScriptsAboutSettingsChange()

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

  await notifyContentScriptsAboutSettingsChange()

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
  await notifyContentScriptsAboutSettingsChange((document) => ({
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

test("tab manager restores tracked documents before notifying settings changes", async () => {
  const sentMessages: Array<{
    message: unknown
    options?: chrome.tabs.MessageSendOptions
    tabId: number
  }> = []
  const localValues: Record<string, unknown> = {
    [TAB_MANAGER_RUNTIME_STATE_KEY]: {
      documentsByTab: {
        "21": [
          {
            documentId: "doc-restored",
            frameId: 0,
            isTopFrame: true,
            scriptId: "script-restored",
            url: "https://chatgpt.com/"
          }
        ],
        "99": [
          {
            documentId: "doc-stale",
            frameId: 0,
            isTopFrame: true,
            scriptId: "script-stale",
            url: "https://stale.example/"
          }
        ]
      },
      savedAt: Date.now(),
      version: TAB_MANAGER_RUNTIME_STATE_VERSION
    }
  }

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      },
      onMessage: {
        addListener() {}
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
      onRemoved: {
        addListener() {}
      },
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void
      ) {
        const tabs = [
          { id: 21, url: "https://chatgpt.com/" } as chrome.tabs.Tab,
          { id: 22, url: "https://other.example/" } as chrome.tabs.Tab
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
        sendResponse?.()
      }
    }
  })

  initTabManager()
  await notifyContentScriptsAboutSettingsChange()

  assert.deepEqual(sentMessages, [
    {
      message: {
        scriptId: "script-restored",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { documentId: "doc-restored" },
      tabId: 21
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 21
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 22
    }
  ])
  assert.equal(getTrackedDocumentCountForTesting(), 1)
})

test("tab manager ignores expired persisted runtime state", async () => {
  const sentMessages: Array<{
    message: unknown
    options?: chrome.tabs.MessageSendOptions
    tabId: number
  }> = []
  const localValues: Record<string, unknown> = {
    [TAB_MANAGER_RUNTIME_STATE_KEY]: {
      documentsByTab: {
        "21": [
          {
            documentId: "doc-expired",
            frameId: 0,
            isTopFrame: true,
            scriptId: "script-expired",
            url: "https://chatgpt.com/"
          }
        ]
      },
      savedAt: Date.now() - TAB_MANAGER_RUNTIME_STATE_MAX_AGE_MS - 1,
      version: TAB_MANAGER_RUNTIME_STATE_VERSION
    }
  }

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      },
      onMessage: {
        addListener() {}
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
      onRemoved: {
        addListener() {}
      },
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void
      ) {
        const tabs = [
          { id: 21, url: "https://chatgpt.com/" } as chrome.tabs.Tab
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
        sendResponse?.()
      }
    }
  })

  initTabManager()
  await notifyContentScriptsAboutSettingsChange()

  assert.deepEqual(sentMessages, [
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 21
    }
  ])
  assert.equal(getTrackedDocumentCountForTesting(), 0)
})

test("tab manager broadcasts to a tracked tab when targeted delivery fails", async () => {
  const runtimeMessageListeners: Array<
    (message: unknown, sender: chrome.runtime.MessageSender) => boolean
  > = []
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
        addListener() {}
      },
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void
      ) {
        const tabs = [
          { id: 31, url: "https://chatgpt.com/" } as chrome.tabs.Tab
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
        runtimeLastError = options ? { message: "No receiving end" } : undefined
        sendResponse?.()
        runtimeLastError = undefined
      }
    }
  })

  initTabManager()
  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: true,
        url: "https://chatgpt.com/"
      },
      scriptId: "script-stale",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "doc-stale",
      frameId: 0,
      tab: { id: 31 } as chrome.tabs.Tab
    }
  )

  await notifyContentScriptsAboutSettingsChange()

  assert.deepEqual(sentMessages, [
    {
      message: {
        scriptId: "script-stale",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { documentId: "doc-stale" },
      tabId: 31
    },
    {
      message: {
        scriptId: "script-stale",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { documentId: "doc-stale", frameId: 0 },
      tabId: 31
    },
    {
      message: {
        scriptId: "script-stale",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { frameId: 0 },
      tabId: 31
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 31
    }
  ])
  assert.equal(getTrackedDocumentCountForTesting(), 0)
})

test("tab manager coalesces synchronous runtime state writes", async () => {
  const runtimeMessageListeners: Array<
    (message: unknown, sender: chrome.runtime.MessageSender) => boolean
  > = []
  const storageWrites: Record<string, unknown>[] = []
  const localValues: Record<string, unknown> = {}

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      },
      onMessage: {
        addListener(listener: (typeof runtimeMessageListeners)[number]) {
          runtimeMessageListeners.push(listener)
        }
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
          storageWrites.push(items)
          Object.assign(localValues, items)
          callback()
        }
      }
    },
    tabs: {
      onRemoved: {
        addListener() {}
      },
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void
      ) {
        const tabs = [
          { id: 41, url: "https://chatgpt.com/" } as chrome.tabs.Tab
        ]
        callback?.(tabs)
        return Promise.resolve(tabs)
      },
      sendMessage(
        _tabId: number,
        _message: unknown,
        optionsOrCallback?: chrome.tabs.MessageSendOptions | (() => void),
        callback?: () => void
      ) {
        const sendResponse =
          typeof optionsOrCallback === "function" ? optionsOrCallback : callback
        sendResponse?.()
      }
    }
  })

  initTabManager()
  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: true,
        url: "https://chatgpt.com/"
      },
      scriptId: "script-1",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "doc-1",
      frameId: 0,
      tab: { id: 41 } as chrome.tabs.Tab
    }
  )
  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: false,
        url: "https://chatgpt.com/frame"
      },
      scriptId: "script-2",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "doc-2",
      frameId: 1,
      tab: { id: 41 } as chrome.tabs.Tab
    }
  )

  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(storageWrites.length, 1)
  assert.deepEqual(
    (
      storageWrites[0][TAB_MANAGER_RUNTIME_STATE_KEY] as {
        documentsByTab: Record<string, Array<{ documentId: string | null }>>
        version: number
      }
    ).documentsByTab["41"].map((document) => document.documentId),
    ["doc-1", "doc-2"]
  )
  assert.equal(
    (
      storageWrites[0][TAB_MANAGER_RUNTIME_STATE_KEY] as {
        version: number
      }
    ).version,
    TAB_MANAGER_RUNTIME_STATE_VERSION
  )
})

test("tab manager survives a simulated MV3 service worker restart", async () => {
  const runtimeMessageListeners: Array<
    (message: unknown, sender: chrome.runtime.MessageSender) => boolean
  > = []
  const sentMessages: Array<{
    message: unknown
    options?: chrome.tabs.MessageSendOptions
    tabId: number
  }> = []
  const localValues: Record<string, unknown> = {}

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      },
      onMessage: {
        addListener(listener: (typeof runtimeMessageListeners)[number]) {
          runtimeMessageListeners.push(listener)
        }
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
      onRemoved: {
        addListener() {}
      },
      query(
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void
      ) {
        const tabs = [
          { id: 51, url: "https://chatgpt.com/" } as chrome.tabs.Tab
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
        sendResponse?.()
      }
    }
  })

  initTabManager()
  runtimeMessageListeners[0](
    {
      data: {
        isTopFrame: true,
        url: "https://chatgpt.com/"
      },
      scriptId: "script-before-restart",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "doc-before-restart",
      frameId: 0,
      tab: { id: 51 } as chrome.tabs.Tab
    }
  )

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.ok(localValues[TAB_MANAGER_RUNTIME_STATE_KEY])

  resetTabManagerStateForTesting()
  sentMessages.length = 0

  initTabManager()
  await notifyContentScriptsAboutSettingsChange()

  assert.deepEqual(sentMessages, [
    {
      message: {
        scriptId: "script-before-restart",
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: { documentId: "doc-before-restart" },
      tabId: 51
    },
    {
      message: {
        type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
      },
      options: undefined,
      tabId: 51
    }
  ])
  assert.equal(getTrackedDocumentCountForTesting(), 1)
})
