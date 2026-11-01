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
  sender: chrome.runtime.MessageSender,
  sendResponse?: (response?: unknown) => void
) => boolean

function createChromeMock(
  openTabs: chrome.tabs.Tab[] = [],
  options: {
    deferSendCallbacks?: boolean
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
  const pendingSendCallbacks: Array<() => void> = []
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
        const sendOptions =
          typeof optionsOrCallback === "function"
            ? undefined
            : optionsOrCallback
        sentMessages.push({ message, options: sendOptions, tabId })
        const callback =
          typeof optionsOrCallback === "function"
            ? optionsOrCallback
            : maybeCallback
        const shouldFail = sendFailures > 0
        if (shouldFail) sendFailures -= 1
        const runCallback = () => {
          runtimeError = shouldFail
            ? { message: "receiving end unavailable" }
            : undefined
          callback?.()
          runtimeError = undefined
        }
        if (options.deferSendCallbacks) pendingSendCallbacks.push(runCallback)
        else runCallback()
      }
    }
  })

  return {
    messageListeners,
    removedListeners,
    removedStorageKeys,
    flushSendCallbacks() {
      while (pendingSendCallbacks.length > 0) {
        pendingSendCallbacks.shift()?.()
      }
    },
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

test("tab manager resolves inherited blank-frame URLs from the browser-provided origin", () => {
  const runtime = createChromeMock()
  const documents: FontaraTrackedDocument[] = []
  initTabManager({
    createDocumentMessage(document) {
      documents.push({ ...document })
      return { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED }
    }
  })

  runtime.messageListeners[0]?.(
    {
      pageURL:
        "https://FRAME.example/projects/private?token=discarded#fragment",
      scriptId: "blank-frame-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "blank-frame-document",
      frameId: 4,
      origin: "https://FRAME.example/?secret=discarded#fragment",
      tab: { id: 44, url: "https://top.example/private" } as chrome.tabs.Tab,
      url: "about:blank"
    }
  )

  assert.deepEqual(documents, [
    {
      documentId: "blank-frame-document",
      frameId: 4,
      isTopFrame: false,
      scriptId: "blank-frame-script",
      url: "https://frame.example/projects/private"
    }
  ])
  assert.equal(getTrackedDocumentCountForTesting(), 1)
})

test("tab manager rejects a hostile related-frame page path from another origin", () => {
  const runtime = createChromeMock()
  const documents: FontaraTrackedDocument[] = []
  initTabManager({
    createDocumentMessage(document) {
      documents.push({ ...document })
      return { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED }
    }
  })

  runtime.messageListeners[0]?.(
    {
      pageURL: "https://attacker.invalid/borrowed-path",
      scriptId: "related-frame-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "related-frame-document",
      frameId: 5,
      origin: "https://trusted.example",
      tab: { id: 44 } as chrome.tabs.Tab,
      url: "about:srcdoc"
    }
  )

  assert.equal(documents[0]?.url, "https://trusted.example/")
})

test("tab manager reuses a URL only for the exact tracked document", () => {
  const runtime = createChromeMock()
  const documents: FontaraTrackedDocument[] = []
  initTabManager({
    createDocumentMessage(document) {
      documents.push({ ...document })
      return { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED }
    }
  })

  const trackedSender = {
    documentId: "srcdoc-document",
    frameId: 6,
    tab: { id: 45, url: "https://top.example/" } as chrome.tabs.Tab,
    url: "https://frame.example/private?secret=discarded"
  }
  runtime.messageListeners[0]?.(
    {
      scriptId: "srcdoc-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    trackedSender
  )
  runtime.messageListeners[0]?.(
    {
      scriptId: "srcdoc-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE
    },
    {
      ...trackedSender,
      url: "about:srcdoc"
    }
  )

  runtime.messageListeners[0]?.(
    {
      scriptId: "replacement-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      ...trackedSender,
      documentId: "replacement-document",
      url: "about:srcdoc"
    }
  )

  assert.deepEqual(
    documents.map(({ scriptId, url }) => ({ scriptId, url })),
    [
      {
        scriptId: "srcdoc-script",
        url: "https://frame.example/private"
      },
      {
        scriptId: "srcdoc-script",
        url: "https://frame.example/private"
      }
    ]
  )
  assert.equal(getTrackedDocumentCountForTesting(), 1)
})

test("tab manager never borrows the top-tab URL for an opaque child frame", () => {
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
      pageURL: "https://attacker.invalid/borrowed-path",
      scriptId: "opaque-child-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "opaque-child-document",
      frameId: 8,
      origin: "null",
      tab: { id: 46, url: "https://top.example/private" } as chrome.tabs.Tab,
      url: "about:blank"
    }
  )

  assert.deepEqual(documents, [])
  assert.equal(getTrackedDocumentCountForTesting(), 0)
})

test("tab manager can use the trusted tab URL for a top-level sender only", () => {
  const runtime = createChromeMock()
  const documents: FontaraTrackedDocument[] = []
  initTabManager({
    createDocumentMessage(document) {
      documents.push({ ...document })
      return { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED }
    }
  })

  runtime.messageListeners[0]?.(
    {
      scriptId: "top-fallback-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "top-fallback-document",
      frameId: 0,
      tab: {
        id: 47,
        url: "https://TOP.example/path?secret=discarded"
      } as chrome.tabs.Tab,
      url: "about:blank"
    }
  )

  assert.deepEqual(documents, [
    {
      documentId: "top-fallback-document",
      frameId: 0,
      isTopFrame: true,
      scriptId: "top-fallback-script",
      url: "https://top.example/path"
    }
  ])
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
    {
      scriptId: "reject-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET
    },
    {
      frameId: 0,
      tab: { id: 70 } as chrome.tabs.Tab,
      url: "https://example.com/"
    }
  )
  assert.equal(getTrackedDocumentCountForTesting(), 0)
})

test("stale document callbacks and forgets cannot remove a replacement", () => {
  const runtime = createChromeMock([], {
    deferSendCallbacks: true,
    sendFailures: 3
  })
  initTabManager({
    createDocumentMessage(document) {
      if (document.scriptId === "new-script") {
        return new Promise(() => {})
      }
      return { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED }
    }
  })

  const sender = {
    documentId: "old-document",
    frameId: 0,
    tab: { id: 81 } as chrome.tabs.Tab,
    url: "https://example.com/old"
  }
  runtime.messageListeners[0]?.(
    {
      scriptId: "old-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    sender
  )
  runtime.messageListeners[0]?.(
    {
      scriptId: "new-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      ...sender,
      documentId: "new-document",
      url: "https://example.com/new"
    }
  )

  runtime.messageListeners[0]?.(
    {
      scriptId: "old-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET
    },
    sender
  )
  runtime.flushSendCallbacks()

  assert.equal(getTrackedDocumentCountForTesting(), 1)
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

test("tab manager drops a slow stale resolution and orders the newest command", async () => {
  const runtime = createChromeMock()
  const resolutions: Array<
    (value: {
      message: { type: typeof MESSAGE_TYPES_BG_TO_CS.CLEAN_UP }
      settingsRevision: number
    }) => void
  > = []
  initTabManager({
    createDocumentMessage() {
      return new Promise((resolve) => resolutions.push(resolve))
    }
  })

  runtime.messageListeners[0]?.(
    {
      scriptId: "ordered-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "ordered-document",
      frameId: 0,
      tab: { id: 91 } as chrome.tabs.Tab,
      url: "https://example.com/"
    }
  )
  const update = notifyContentScriptsAboutSettingsChange()
  assert.equal(resolutions.length, 2)

  resolutions[1]?.({
    message: { type: MESSAGE_TYPES_BG_TO_CS.CLEAN_UP },
    settingsRevision: 12
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  resolutions[0]?.({
    message: { type: MESSAGE_TYPES_BG_TO_CS.CLEAN_UP },
    settingsRevision: 11
  })
  await update
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(runtime.sentMessages.length, 1)
  assert.deepEqual(runtime.sentMessages[0]?.message, {
    commandOrder: {
      dispatcherId: (
        runtime.sentMessages[0]?.message as {
          commandOrder: { dispatcherId: string }
        }
      ).commandOrder.dispatcherId,
      sequence: 1,
      settingsRevision: 12
    },
    scriptId: "ordered-script",
    type: MESSAGE_TYPES_BG_TO_CS.CLEAN_UP
  })
  assert.match(
    (
      runtime.sentMessages[0]?.message as {
        commandOrder: { dispatcherId: string }
      }
    ).commandOrder.dispatcherId,
    /\S+/
  )
})

test("document lifecycle messages keep the worker event alive through async resolution", async () => {
  const runtime = createChromeMock()
  let resolveTheme: (() => void) | undefined
  initTabManager({
    async createDocumentMessage() {
      await new Promise<void>((resolve) => {
        resolveTheme = resolve
      })
      return { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED }
    }
  })
  let responseCount = 0

  const keepsEventAlive = runtime.messageListeners[0]?.(
    {
      scriptId: "worker-lifetime-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "worker-lifetime-document",
      frameId: 0,
      tab: { id: 95 } as chrome.tabs.Tab,
      url: "https://example.com/"
    },
    () => {
      responseCount += 1
    }
  )

  assert.equal(keepsEventAlive, true)
  assert.equal(responseCount, 0)
  assert.equal(runtime.sentMessages.length, 0)

  resolveTheme?.()
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(responseCount, 1)
  assert.equal(runtime.sentMessages.length, 1)
})

test("resolved commands can keep the worker alive while a font downloads", async () => {
  const runtime = createChromeMock()
  let finishDownload: (() => void) | undefined
  initTabManager({
    createDocumentMessage() {
      return {
        keepAlive: new Promise<void>((resolve) => {
          finishDownload = resolve
        }),
        message: { type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED },
        settingsRevision: 1
      }
    }
  })
  let responseCount = 0

  const keepsEventAlive = runtime.messageListeners[0]?.(
    {
      scriptId: "font-download-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    {
      documentId: "font-download-document",
      frameId: 0,
      tab: { id: 96 } as chrome.tabs.Tab,
      url: "https://example.com/"
    },
    () => {
      responseCount += 1
    }
  )

  assert.equal(keepsEventAlive, true)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(runtime.sentMessages.length, 1)
  assert.equal(responseCount, 0)

  finishDownload?.()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(responseCount, 1)
})

test("tab manager serializes deliveries and preserves per-document sequence", async () => {
  const runtime = createChromeMock([], { deferSendCallbacks: true })
  let settingsRevision = 20
  initTabManager({
    createDocumentMessage() {
      return {
        message: { type: MESSAGE_TYPES_BG_TO_CS.CLEAN_UP },
        settingsRevision: settingsRevision++
      }
    }
  })

  const sender = {
    documentId: "serial-document",
    frameId: 0,
    tab: { id: 92 } as chrome.tabs.Tab,
    url: "https://example.com/"
  }
  runtime.messageListeners[0]?.(
    {
      scriptId: "serial-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    },
    sender
  )
  runtime.messageListeners[0]?.(
    {
      scriptId: "serial-script",
      type: MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE
    },
    sender
  )

  assert.equal(runtime.sentMessages.length, 1)
  runtime.flushSendCallbacks()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(runtime.sentMessages.length, 2)

  const orders = runtime.sentMessages.map(
    ({ message }) =>
      (
        message as {
          commandOrder: { sequence: number; settingsRevision: number }
        }
      ).commandOrder
  )
  assert.deepEqual(
    orders.map(({ sequence, settingsRevision: revision }) => ({
      revision,
      sequence
    })),
    [
      { revision: 20, sequence: 1 },
      { revision: 21, sequence: 2 }
    ]
  )
  runtime.flushSendCallbacks()
})
