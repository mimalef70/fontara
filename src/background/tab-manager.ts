import type {
  FontaraContentCommandMessage,
  FontaraContentScriptMessage
} from "../definitions"
import {
  MESSAGE_TYPES_BG_TO_CS,
  MESSAGE_TYPES_CS_TO_BG
} from "../utils/message"

export type FontaraTrackedDocument = {
  documentId: string | null
  frameId: number
  isTopFrame: boolean
  scriptId: string
  url: string
}

type DocumentMessageFactory = (
  document: FontaraTrackedDocument
) => FontaraContentCommandMessage | Promise<FontaraContentCommandMessage>

type TabManagerOptions = {
  createDocumentMessage?: DocumentMessageFactory
}

const documentsByTab = new Map<number, Map<number, FontaraTrackedDocument>>()

let initialized = false
let createDocumentMessage: DocumentMessageFactory | null = null

function isFontaraContentMessage(
  message: unknown
): message is FontaraContentScriptMessage {
  if (typeof message !== "object" || message === null) return false

  const value = message as Partial<FontaraContentScriptMessage>
  return (
    typeof value.scriptId === "string" &&
    typeof value.type === "string" &&
    (Object.values(MESSAGE_TYPES_CS_TO_BG) as string[]).includes(value.type)
  )
}

function getSenderTabId(sender: chrome.runtime.MessageSender): number | null {
  return typeof sender.tab?.id === "number" ? sender.tab.id : null
}

function getSenderFrameId(sender: chrome.runtime.MessageSender): number {
  return typeof sender.frameId === "number" ? sender.frameId : 0
}

function getSenderDocumentId(
  sender: chrome.runtime.MessageSender
): string | null {
  return typeof sender.documentId === "string" ? sender.documentId : null
}

function upsertDocument(
  tabId: number,
  frameId: number,
  documentId: string | null,
  message: FontaraContentScriptMessage
): void {
  let documents = documentsByTab.get(tabId)
  if (!documents) {
    documents = new Map()
    documentsByTab.set(tabId, documents)
  }

  documents.set(frameId, {
    documentId,
    frameId,
    isTopFrame: message.data.isTopFrame,
    scriptId: message.scriptId,
    url: message.data.url
  })
}

function removeDocument(tabId: number, frameId: number): void {
  const documents = documentsByTab.get(tabId)
  if (!documents) return

  documents.delete(frameId)
  if (documents.size === 0) {
    documentsByTab.delete(tabId)
  }
}

function messageListener(
  message: unknown,
  sender: chrome.runtime.MessageSender
): boolean {
  if (!isFontaraContentMessage(message)) {
    return false
  }

  const tabId = getSenderTabId(sender)
  if (tabId === null) {
    return false
  }

  const frameId = getSenderFrameId(sender)
  const documentId = getSenderDocumentId(sender)
  switch (message.type) {
    case MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT:
    case MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME:
    case MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE:
      upsertDocument(tabId, frameId, documentId, message)
      if (createDocumentMessage) {
        const documents = documentsByTab.get(tabId)
        const document = documents?.get(frameId)
        if (document) {
          sendDocumentMessageFromFactory(tabId, document, createDocumentMessage)
        }
      }
      break
    case MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET:
      removeDocument(tabId, frameId)
      break
  }

  return false
}

function sendDocumentMessage(
  tabId: number,
  document: FontaraTrackedDocument,
  message: FontaraContentCommandMessage
): void {
  const sendOptions: chrome.tabs.MessageSendOptions[] = document.documentId
    ? [
        { documentId: document.documentId },
        { documentId: document.documentId, frameId: document.frameId },
        { frameId: document.frameId }
      ]
    : [{ frameId: document.frameId }]
  let optionIndex = 0

  const sendNext = (): void => {
    const options = sendOptions[optionIndex]

    if (!options) {
      removeDocument(tabId, document.frameId)
      return
    }

    try {
      chrome.tabs.sendMessage(tabId, message, options, () => {
        const error = chrome.runtime?.lastError
        if (!error) return

        optionIndex += 1
        sendNext()
      })
    } catch {
      optionIndex += 1
      sendNext()
    }
  }

  sendNext()
}

function createSettingsChangedMessage(): FontaraContentCommandMessage {
  return {
    type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
  }
}

function isSupportedTabURL(url: unknown): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url)
}

function sendSettingsChangedMessageToTab(tabId: number): void {
  try {
    chrome.tabs.sendMessage(tabId, createSettingsChangedMessage(), () => {
      // Missing content scripts are expected on tabs where FontAra is not injected.
      void chrome.runtime?.lastError
    })
  } catch {}
}

function notifyUntrackedTabsAboutSettingsChange(
  trackedTabIds: Set<number>
): void {
  try {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (typeof tab.id !== "number") continue
        if (trackedTabIds.has(tab.id)) continue
        if (!isSupportedTabURL(tab.url)) continue

        sendSettingsChangedMessageToTab(tab.id)
      }
    })
  } catch {}
}

function isPromiseLikeMessage(
  message: FontaraContentCommandMessage | Promise<FontaraContentCommandMessage>
): message is Promise<FontaraContentCommandMessage> {
  return (
    typeof message === "object" &&
    message !== null &&
    "then" in message &&
    typeof message.then === "function"
  )
}

function sendResolvedDocumentMessage(
  tabId: number,
  document: FontaraTrackedDocument,
  message: FontaraContentCommandMessage
): void {
  sendDocumentMessage(tabId, document, {
    ...message,
    scriptId: document.scriptId
  })
}

function sendDocumentMessageFromFactory(
  tabId: number,
  document: FontaraTrackedDocument,
  factory: DocumentMessageFactory
): void {
  try {
    const message = factory(document)

    if (!isPromiseLikeMessage(message)) {
      sendResolvedDocumentMessage(tabId, document, message)
      return
    }

    void message
      .catch(() => createSettingsChangedMessage())
      .then((resolvedMessage) => {
        sendResolvedDocumentMessage(tabId, document, resolvedMessage)
      })
  } catch {
    sendResolvedDocumentMessage(tabId, document, createSettingsChangedMessage())
  }
}

export function initTabManager(options: TabManagerOptions = {}): void {
  if (options.createDocumentMessage) {
    createDocumentMessage = options.createDocumentMessage
  }

  if (initialized) return

  chrome.runtime.onMessage.addListener(messageListener)
  chrome.tabs.onRemoved.addListener((tabId) => {
    documentsByTab.delete(tabId)
  })
  initialized = true
}

export function notifyContentScriptsAboutSettingsChange(
  factory: DocumentMessageFactory = createDocumentMessage ??
    createSettingsChangedMessage
): void {
  const trackedTabIds = new Set<number>()

  for (const [tabId, documents] of documentsByTab) {
    trackedTabIds.add(tabId)
    for (const document of documents.values()) {
      sendDocumentMessageFromFactory(tabId, document, factory)
    }
  }

  notifyUntrackedTabsAboutSettingsChange(trackedTabIds)
}

export function getTrackedDocumentCountForTesting(): number {
  let count = 0
  for (const documents of documentsByTab.values()) {
    count += documents.size
  }
  return count
}
