import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import {
  type FontaraTrackedDocument,
  getTrackedDocumentCountForTesting,
  initTabManager,
  notifyContentScriptsAboutSettingsChange,
  resetTabManagerStateForTesting
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

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender
) => boolean

function createChromeMock(
  openTabs: chrome.tabs.Tab[] = [],
  options: {
    queryThrows?: boolean
    removeThrows?: boolean
    sendFailures?: number
    sendThrows?: number
  } = {}
) {
  const messageListeners: MessageListener[] = []
  const removedListeners: Array<(tabId: number) => void> = []
  const sentMessages: Array<{
    message: unknown
    options?: chrome.tabs.MessageSendOptions
    tabId: number
  }> = []
  const removedStorageKeys: string[] = []
  let runtimeError: { message: string } | undefined
  let sendFailures = options.sendFailures ?? 0
  let sendThrows = options.sendThrows ?? 0

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return runtimeError
      },
      onMessage: {
        addListener(listener: MessageListener) {
          messageListeners.push(listener)
        }
      }
    },
    storage: {
      local: {
        remove(key: string, callback?: () => void) {
          if (options.removeThrows) throw new Error("storage unavailable")
          removedStorageKeys.push(key)
          callback?.()
        }
      }
    },
    tabs: {
      onRemoved: {
        addListener(listener: (tabId: number) => void) {
          removedListeners.push(listener)
        }
      },
      query(
        _query: chrome.tabs.QueryInfo,
        callback: (tabs: chrome.tabs.Tab[]) => void
      ) {
        if (options.queryThrows) throw new Error("tabs unavailable")
        callback(openTabs)
      },
      sendMessage(
        tabId: number,
        message: unknown,
        optionsOrCallback?:
          | chrome.tabs.MessageSendOptions
          | ((response?: unknown) => void),
        maybeCallback?: (response?: unknown) => void
      ) {
        if (sendThrows > 0) {
          sendThrows -= 1
          throw new Error("send unavailable")
        }
        const options =
          typeof optionsOrCallback === "function"
            ? undefined
            : optionsOrCallback
        sentMessages.push({ message, options, tabId })
        const callback =
          typeof optionsOrCallback === "function"
            ? optionsOrCallback
            : maybeCallback
        runtimeError =
          sendFailures > 0
            ? { message: "receiving end unavailable" }
            : undefined
        if (sendFailures > 0) sendFailures -= 1
        callback?.()
        runtimeError = undefined
      }
    }
  })

  return {
    messageListeners,
    removedListeners,
    removedStorageKeys,
    setSendFailures(count: number) {
      sendFailures = count
    },
    sentMessages
  }
}

test("tab manager derives frame identity and URL only from MessageSender", () => {
  const runtime = createChromeMock()
  const documents: FontaraTrackedDocument[] = []
  initTabManager({
    createDocumentMessage(document) {
      documents.push(document)
      return { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED }
    }
  })

  runtime.messageListeners[0]?.(
    {
      data: {
        isTopFrame: true,
        url: "https://attacker.invalid/?secret=payload"
      },
      scriptId: "frame-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "document-2",
      frameId: 7,
      tab: { id: 42, url: "https://top.example/" } as chrome.tabs.Tab,
      url: "https://user:password@TRUSTED.example/frame?token=secret#message"
    }
  )

  assert.deepEqual(documents, [
    {
      documentId: "document-2",
      frameId: 7,
      isTopFrame: false,
      scriptId: "frame-script",
      url: "https://trusted.example/frame"
    }
  ])
  assert.equal(getTrackedDocumentCountForTesting(), 1)
  assert.deepEqual(runtime.sentMessages[0], {
    message: {
      scriptId: "frame-script",
      type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
    },
    options: { documentId: "document-2" },
    tabId: 42
  })

  runtime.messageListeners[0]?.(
    {
      scriptId: "missing-frame",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      tab: { id: 43 } as chrome.tabs.Tab,
      url: "https://untrusted.example/"
    }
  )
  assert.equal(getTrackedDocumentCountForTesting(), 1)
})

test("tab manager keeps bookkeeping in memory and removes closed documents", () => {
  const runtime = createChromeMock()
  initTabManager()

  assert.deepEqual(runtime.removedStorageKeys, [
    "__fontara_tab_manager_state__"
  ])

  runtime.messageListeners[0]?.(
    {
      scriptId: "top-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      frameId: 0,
      tab: { id: 9 } as chrome.tabs.Tab,
      url: "https://example.com/?credential=never-persisted"
    }
  )
  assert.equal(getTrackedDocumentCountForTesting(), 1)

  runtime.removedListeners[0]?.(9)
  assert.equal(getTrackedDocumentCountForTesting(), 0)
})

test("settings changes broadcast safely to untracked HTTP tabs after restart", async () => {
  const runtime = createChromeMock([
    { id: 10, url: "https://example.com/private?token=1" } as chrome.tabs.Tab,
    { id: 11, url: "chrome://settings" } as chrome.tabs.Tab
  ])
  initTabManager()

  await notifyContentScriptsAboutSettingsChange()

  assert.deepEqual(runtime.sentMessages, [
    {
      message: { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED },
      options: undefined,
      tabId: 10
    }
  ])
})

test("tracked delivery retries document targets and falls back tab-wide", async () => {
  const runtime = createChromeMock()
  initTabManager({
    createDocumentMessage: async () => ({
      type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
    })
  })
  runtime.messageListeners[0]?.(
    {
      scriptId: "retry-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "retry-document",
      frameId: 2,
      tab: { id: 52 } as chrome.tabs.Tab,
      url: "https://example.com/frame"
    }
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  runtime.sentMessages.length = 0
  runtime.setSendFailures(3)
  await notifyContentScriptsAboutSettingsChange()
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(
    runtime.sentMessages.map((item) => item.options),
    [
      { documentId: "retry-document" },
      { documentId: "retry-document", frameId: 2 },
      { frameId: 2 },
      undefined
    ]
  )
  assert.equal(getTrackedDocumentCountForTesting(), 0)
})

test("tab manager handles rejected factories, thrown sends, forgets, and invalid senders", async () => {
  const runtime = createChromeMock([], { sendThrows: 1 })
  initTabManager({
    createDocumentMessage(document) {
      if (document.scriptId === "reject-script") {
        return Promise.reject(new Error("factory rejected"))
      }
      if (document.scriptId === "throw-script") {
        throw new Error("factory threw")
      }
      return { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED }
    }
  })

  assert.equal(runtime.messageListeners[0]?.({ type: "invalid" }, {}), false)
  assert.equal(
    runtime.messageListeners[0]?.(
      {
        scriptId: "missing-tab",
        type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
      },
      { frameId: 0, url: "https://example.com/" }
    ),
    false
  )

  for (const [index, scriptId] of ["reject-script", "throw-script"].entries()) {
    runtime.messageListeners[0]?.(
      { scriptId, type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT },
      {
        frameId: index,
        tab: { id: 70 } as chrome.tabs.Tab,
        url: `https://example.com/${index}`
      }
    )
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(getTrackedDocumentCountForTesting(), 1)

  runtime.messageListeners[0]?.(
    { scriptId: "forget", type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET },
    {
      frameId: 0,
      tab: { id: 70 } as chrome.tabs.Tab,
      url: "https://example.com/"
    }
  )
  assert.equal(getTrackedDocumentCountForTesting(), 0)
})

test("tab manager tolerates unavailable storage and tabs APIs", async () => {
  const runtime = createChromeMock([], {
    queryThrows: true,
    removeThrows: true
  })
  assert.doesNotThrow(() => initTabManager())
  await assert.doesNotReject(notifyContentScriptsAboutSettingsChange())
  assert.deepEqual(runtime.removedStorageKeys, [])
  assert.deepEqual(runtime.sentMessages, [])
})
