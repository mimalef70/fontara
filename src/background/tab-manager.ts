import type {
  FontaraContentCommandMessage,
  FontaraContentCommandOrder,
  FontaraContentScriptMessage
} from "../definitions"
import {
  isFontaraContentScriptMessage,
  MESSAGE_TYPES_BG_TO_CS,
  MESSAGE_TYPES_CS_TO_BG
} from "../utils/message"
import { sanitizeRuntimePageURL } from "../utils/runtime-url"

export type FontaraTrackedDocument = {
  documentId: string | null
  frameId: number
  isTopFrame: boolean
  scriptId: string
  url: string
}

type DocumentMessageFactory = (
  document: FontaraTrackedDocument
) => DocumentMessageFactoryResult | Promise<DocumentMessageFactoryResult>

export type FontaraResolvedDocumentMessage = {
  message: FontaraContentCommandMessage
  settingsRevision: number
}

type DocumentMessageFactoryResult =
  | FontaraContentCommandMessage
  | FontaraResolvedDocumentMessage

type TabManagerOptions = {
  createDocumentMessage?: DocumentMessageFactory
}

const documentsByTab = new Map<number, Map<number, FontaraTrackedDocument>>()
const LEGACY_TAB_MANAGER_RUNTIME_STATE_KEY = "__fontara_tab_manager_state__"
const MAX_COMMAND_SEQUENCE = Number.MAX_SAFE_INTEGER

type PendingDocumentDelivery = {
  message: FontaraContentCommandMessage
  onDeliveryFailure?: () => void
  requestId: number
  settingsRevision: number
}

type DocumentDispatchState = {
  deliveryRunning: boolean
  latestRequestId: number
  nextSequence: number
  pendingDelivery: PendingDocumentDelivery | null
}

let initialized = false
let createDocumentMessage: DocumentMessageFactory | null = null
let dispatchStates = new WeakMap<
  FontaraTrackedDocument,
  DocumentDispatchState
>()
let commandDispatcherId = createCommandDispatcherId()

function createCommandDispatcherId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID()
    }
  } catch {}

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function clearLegacyPersistedState(): void {
  try {
    chrome.storage?.local?.remove(LEGACY_TAB_MANAGER_RUNTIME_STATE_KEY, () => {
      void chrome.runtime?.lastError
    })
  } catch {}
}

function getSenderTabId(sender: chrome.runtime.MessageSender): number | null {
  return typeof sender.tab?.id === "number" ? sender.tab.id : null
}

function getSenderFrameId(sender: chrome.runtime.MessageSender): number | null {
  return typeof sender.frameId === "number" ? sender.frameId : null
}

function getSenderDocumentId(
  sender: chrome.runtime.MessageSender
): string | null {
  return typeof sender.documentId === "string" ? sender.documentId : null
}

function getPreviouslyTrackedDocumentURL(
  sender: chrome.runtime.MessageSender,
  message: FontaraContentScriptMessage
): string | null {
  const tabId = getSenderTabId(sender)
  const frameId = getSenderFrameId(sender)
  if (tabId === null || frameId === null) return null

  const existingDocument = documentsByTab.get(tabId)?.get(frameId)
  if (!existingDocument || existingDocument.scriptId !== message.scriptId) {
    return null
  }

  if (existingDocument.documentId !== getSenderDocumentId(sender)) return null
  return sanitizeRuntimePageURL(existingDocument.url)
}

function getSenderURL(
  sender: chrome.runtime.MessageSender,
  message: FontaraContentScriptMessage
): string | null {
  const senderURL = sanitizeRuntimePageURL(sender.url)
  if (senderURL) return senderURL

  // A resume/update from the exact same document can safely retain its
  // previously sanitized path when a browser temporarily omits the URL. Do
  // not reuse another frame or another document's URL.
  const trackedDocumentURL = getPreviouslyTrackedDocumentURL(sender, message)
  if (trackedDocumentURL) return trackedDocumentURL

  // `about:blank` and `about:srcdoc` frames have a non-HTTP sender URL, but
  // Chromium exposes their effective HTTP(S) origin separately. Using that
  // browser-provided origin keeps these inherited frames covered without ever
  // trusting URL-like data from the content-script message itself.
  const senderOrigin = sanitizeRuntimePageURL(sender.origin)
  if (senderOrigin) {
    const relatedPageURL = sanitizeRuntimePageURL(message.pageURL)
    if (relatedPageURL) {
      try {
        if (new URL(relatedPageURL).origin === new URL(senderOrigin).origin) {
          return relatedPageURL
        }
      } catch {}
    }
    return senderOrigin
  }

  // For a top-level sender only, sender.tab.url describes the same document.
  // It must never be used for a child frame: doing so could incorrectly apply
  // the top site's settings to an opaque or cross-origin subframe.
  if (getSenderFrameId(sender) === 0) {
    return sanitizeRuntimePageURL(sender.tab?.url)
  }

  return null
}

function upsertDocument(
  sender: chrome.runtime.MessageSender,
  message: FontaraContentScriptMessage
): FontaraTrackedDocument | null {
  const tabId = getSenderTabId(sender)
  const url = getSenderURL(sender, message)
  const frameId = getSenderFrameId(sender)
  if (tabId === null || frameId === null || !url) return null

  let documents = documentsByTab.get(tabId)
  if (!documents) {
    documents = new Map()
    documentsByTab.set(tabId, documents)
  }

  const documentId = getSenderDocumentId(sender)
  const existingDocument = documents.get(frameId)
  if (
    existingDocument?.scriptId === message.scriptId &&
    existingDocument.documentId === documentId
  ) {
    existingDocument.isTopFrame = frameId === 0
    existingDocument.url = url
    return existingDocument
  }

  const document: FontaraTrackedDocument = {
    documentId,
    frameId,
    isTopFrame: frameId === 0,
    scriptId: message.scriptId,
    url
  }
  documents.set(frameId, document)
  return document
}

function removeDocument(tabId: number, frameId: number): void {
  const documents = documentsByTab.get(tabId)
  if (!documents) return

  documents.delete(frameId)
  if (documents.size === 0) {
    documentsByTab.delete(tabId)
  }
}

function removeDocumentIfCurrent(
  tabId: number,
  document: Pick<FontaraTrackedDocument, "frameId" | "scriptId">
): void {
  const currentDocument = documentsByTab.get(tabId)?.get(document.frameId)
  if (currentDocument?.scriptId !== document.scriptId) return

  removeDocument(tabId, document.frameId)
}

function isCurrentDocument(
  tabId: number,
  document: FontaraTrackedDocument
): boolean {
  return documentsByTab.get(tabId)?.get(document.frameId) === document
}

function sendDocumentMessage(
  tabId: number,
  document: FontaraTrackedDocument,
  message: FontaraContentCommandMessage,
  onDeliveryFailure?: () => void
): Promise<void> {
  const sendOptions: chrome.tabs.MessageSendOptions[] = document.documentId
    ? [
        { documentId: document.documentId },
        { documentId: document.documentId, frameId: document.frameId },
        { frameId: document.frameId }
      ]
    : [{ frameId: document.frameId }]
  let optionIndex = 0

  return new Promise((resolve) => {
    const sendNext = (): void => {
      if (!isCurrentDocument(tabId, document)) {
        resolve()
        return
      }

      const options = sendOptions[optionIndex]
      if (!options) {
        removeDocumentIfCurrent(tabId, document)
        onDeliveryFailure?.()
        resolve()
        return
      }

      try {
        chrome.tabs.sendMessage(tabId, message, options, () => {
          if (!chrome.runtime?.lastError) {
            resolve()
            return
          }
          optionIndex += 1
          sendNext()
        })
      } catch {
        optionIndex += 1
        sendNext()
      }
    }

    sendNext()
  })
}

function createSettingsChangedMessage(): FontaraContentCommandMessage {
  return {
    type: MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED
  }
}

function isPromiseLikeMessage(
  message: DocumentMessageFactoryResult | Promise<DocumentMessageFactoryResult>
): message is Promise<DocumentMessageFactoryResult> {
  return (
    typeof message === "object" &&
    message !== null &&
    "then" in message &&
    typeof message.then === "function"
  )
}

function isResolvedDocumentMessage(
  result: DocumentMessageFactoryResult
): result is FontaraResolvedDocumentMessage {
  return (
    typeof result === "object" &&
    result !== null &&
    "message" in result &&
    "settingsRevision" in result
  )
}

function normalizeSettingsRevision(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function getDocumentDispatchState(
  document: FontaraTrackedDocument
): DocumentDispatchState {
  const existingState = dispatchStates.get(document)
  if (existingState) return existingState

  const state: DocumentDispatchState = {
    deliveryRunning: false,
    latestRequestId: 0,
    nextSequence: 1,
    pendingDelivery: null
  }
  dispatchStates.set(document, state)
  return state
}

function attachCommandOrder(
  message: FontaraContentCommandMessage,
  sequence: number,
  settingsRevision: number
): FontaraContentCommandMessage {
  if (
    message.type !== MESSAGE_TYPES_BG_TO_CS.APPLY_THEME &&
    message.type !== MESSAGE_TYPES_BG_TO_CS.CLEAN_UP
  ) {
    return message
  }

  const commandOrder: FontaraContentCommandOrder = {
    dispatcherId: commandDispatcherId,
    sequence,
    settingsRevision
  }
  return { ...message, commandOrder }
}

function takeNextSequence(state: DocumentDispatchState): number {
  const sequence = state.nextSequence
  state.nextSequence =
    sequence >= MAX_COMMAND_SEQUENCE ? MAX_COMMAND_SEQUENCE : sequence + 1
  return sequence
}

function drainDocumentDeliveries(
  tabId: number,
  document: FontaraTrackedDocument,
  state: DocumentDispatchState
): void {
  if (state.deliveryRunning) return

  const delivery = state.pendingDelivery
  state.pendingDelivery = null
  if (!delivery || !isCurrentDocument(tabId, document)) return
  if (delivery.requestId !== state.latestRequestId) {
    drainDocumentDeliveries(tabId, document, state)
    return
  }

  const orderedMessage = attachCommandOrder(
    delivery.message,
    takeNextSequence(state),
    delivery.settingsRevision
  )
  state.deliveryRunning = true
  void sendDocumentMessage(
    tabId,
    document,
    { ...orderedMessage, scriptId: document.scriptId },
    delivery.onDeliveryFailure
  ).finally(() => {
    state.deliveryRunning = false
    drainDocumentDeliveries(tabId, document, state)
  })
}

function queueResolvedDocumentMessage(
  tabId: number,
  document: FontaraTrackedDocument,
  state: DocumentDispatchState,
  requestId: number,
  result: DocumentMessageFactoryResult,
  onDeliveryFailure?: () => void
): void {
  if (
    requestId !== state.latestRequestId ||
    !isCurrentDocument(tabId, document)
  ) {
    return
  }

  const { message, settingsRevision } = isResolvedDocumentMessage(result)
    ? result
    : { message: result, settingsRevision: 0 }
  // A document needs only the newest not-yet-delivered resolution. This keeps
  // settings bursts and slow font/theme generation from building a stale queue.
  state.pendingDelivery = {
    message,
    onDeliveryFailure,
    requestId,
    settingsRevision: normalizeSettingsRevision(settingsRevision)
  }
  drainDocumentDeliveries(tabId, document, state)
}

function sendDocumentMessageFromFactory(
  tabId: number,
  document: FontaraTrackedDocument,
  factory: DocumentMessageFactory,
  onDeliveryFailure?: () => void
): Promise<void> {
  const state = getDocumentDispatchState(document)
  const requestId = ++state.latestRequestId

  try {
    const result = factory(document)
    if (isPromiseLikeMessage(result)) {
      return result
        .catch(() => createSettingsChangedMessage())
        .then((resolvedMessage) => {
          queueResolvedDocumentMessage(
            tabId,
            document,
            state,
            requestId,
            resolvedMessage,
            onDeliveryFailure
          )
        })
    }

    queueResolvedDocumentMessage(
      tabId,
      document,
      state,
      requestId,
      result,
      onDeliveryFailure
    )
  } catch {
    queueResolvedDocumentMessage(
      tabId,
      document,
      state,
      requestId,
      createSettingsChangedMessage(),
      onDeliveryFailure
    )
  }

  return Promise.resolve()
}

function messageListener(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse?: (response?: unknown) => void
): boolean {
  if (!isFontaraContentScriptMessage(message)) return false

  const tabId = getSenderTabId(sender)
  if (tabId === null) return false

  const frameId = getSenderFrameId(sender)
  if (frameId === null) return false
  switch (message.type) {
    case MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT:
    case MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME:
    case MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE: {
      const document = upsertDocument(sender, message)
      if (document && createDocumentMessage) {
        void sendDocumentMessageFromFactory(
          tabId,
          document,
          createDocumentMessage
        ).then(
          () => sendResponse?.(),
          () => sendResponse?.()
        )
        // Keep the MV3 event alive until async settings/font resolution has
        // completed and the resulting delivery has entered the per-document
        // queue. Otherwise Chrome may suspend the worker mid-resolution.
        return true
      }
      break
    }
    case MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET:
      removeDocumentIfCurrent(tabId, {
        frameId,
        scriptId: message.scriptId
      })
      break
  }

  return false
}

function isSupportedTabURL(url: unknown): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url)
}

function sendSettingsChangedMessageToTab(tabId: number): void {
  try {
    chrome.tabs.sendMessage(tabId, createSettingsChangedMessage(), () => {
      // Tabs without an active content script are expected.
      void chrome.runtime?.lastError
    })
  } catch {}
}

function notifyUntrackedTabsAboutSettingsChange(
  trackedTabIds: Set<number>
): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (typeof tab.id !== "number" || trackedTabIds.has(tab.id)) continue
          if (!isSupportedTabURL(tab.url)) continue
          sendSettingsChangedMessageToTab(tab.id)
        }
        resolve()
      })
    } catch {
      resolve()
    }
  })
}

export function initTabManager(options: TabManagerOptions = {}): void {
  if (options.createDocumentMessage) {
    createDocumentMessage = options.createDocumentMessage
  }
  if (initialized) return

  clearLegacyPersistedState()
  chrome.runtime.onMessage.addListener(messageListener)
  chrome.tabs.onRemoved.addListener((tabId) => {
    documentsByTab.delete(tabId)
  })
  initialized = true
}

export async function notifyContentScriptsAboutSettingsChange(
  factory: DocumentMessageFactory = createDocumentMessage ??
    createSettingsChangedMessage
): Promise<void> {
  const trackedTabIds = new Set<number>()
  const pendingResolutions: Promise<void>[] = []
  for (const [tabId, documents] of documentsByTab) {
    trackedTabIds.add(tabId)
    for (const document of documents.values()) {
      pendingResolutions.push(
        sendDocumentMessageFromFactory(tabId, document, factory, () => {
          sendSettingsChangedMessageToTab(tabId)
        })
      )
    }
  }

  await Promise.allSettled(pendingResolutions)
  await notifyUntrackedTabsAboutSettingsChange(trackedTabIds)
}

export function getTrackedDocumentCountForTesting(): number {
  let count = 0
  for (const documents of documentsByTab.values()) {
    count += documents.size
  }
  return count
}

export function resetTabManagerStateForTesting(): void {
  documentsByTab.clear()
  initialized = false
  createDocumentMessage = null
  dispatchStates = new WeakMap()
  commandDispatcherId = createCommandDispatcherId()
}
