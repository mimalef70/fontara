import type {
  FontaraContentCommandMessage,
  FontaraContentScriptMessage
} from "../definitions"
import {
  isFontaraContentScriptMessage,
  MESSAGE_TYPES_BG_TO_CS,
  MESSAGE_TYPES_CS_TO_BG
} from "../utils/message"
import { RuntimeStateManager } from "./runtime-state-manager"

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

type PersistedDocumentsByTab = Record<string, FontaraTrackedDocument[]>

type TabManagerRuntimeState = {
  documentsByTab: PersistedDocumentsByTab
  savedAt: number
  version: number
}

export const TAB_MANAGER_RUNTIME_STATE_KEY = "__fontara_tab_manager_state__"
export const TAB_MANAGER_RUNTIME_STATE_VERSION = 1
export const TAB_MANAGER_RUNTIME_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const DEFAULT_TAB_MANAGER_RUNTIME_STATE: TabManagerRuntimeState = {
  documentsByTab: {},
  savedAt: 0,
  version: TAB_MANAGER_RUNTIME_STATE_VERSION
}

const documentsByTab = new Map<number, Map<number, FontaraTrackedDocument>>()

let initialized = false
let createDocumentMessage: DocumentMessageFactory | null = null
let runtimeStateManager = createRuntimeStateManager()
let restoreDocumentsPromise: Promise<void> | null = null
let documentsRestored = false
let pendingRuntimeState: TabManagerRuntimeState | null = null
let persistScheduled = false
let persistGeneration = 0

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isTrackedDocument(value: unknown): value is FontaraTrackedDocument {
  return (
    isRecord(value) &&
    (typeof value.documentId === "string" || value.documentId === null) &&
    typeof value.frameId === "number" &&
    typeof value.isTopFrame === "boolean" &&
    typeof value.scriptId === "string" &&
    typeof value.url === "string"
  )
}

function normalizeTabManagerRuntimeState(
  value: unknown
): TabManagerRuntimeState {
  if (!isRecord(value)) return DEFAULT_TAB_MANAGER_RUNTIME_STATE
  if (
    value.version !== undefined &&
    value.version !== TAB_MANAGER_RUNTIME_STATE_VERSION
  ) {
    return DEFAULT_TAB_MANAGER_RUNTIME_STATE
  }

  const savedAt = typeof value.savedAt === "number" ? value.savedAt : 0
  if (
    savedAt <= 0 ||
    Date.now() - savedAt > TAB_MANAGER_RUNTIME_STATE_MAX_AGE_MS
  ) {
    return DEFAULT_TAB_MANAGER_RUNTIME_STATE
  }

  const documentsByTabValue = isRecord(value.documentsByTab)
    ? value.documentsByTab
    : {}
  const documentsByTab: PersistedDocumentsByTab = {}

  for (const [tabId, documents] of Object.entries(documentsByTabValue)) {
    if (!/^\d+$/.test(tabId) || !Array.isArray(documents)) continue

    const normalizedDocuments = documents.filter(isTrackedDocument)
    if (normalizedDocuments.length > 0) {
      documentsByTab[tabId] = normalizedDocuments
    }
  }

  return {
    documentsByTab,
    savedAt,
    version: TAB_MANAGER_RUNTIME_STATE_VERSION
  }
}

function createRuntimeStateManager(): RuntimeStateManager<TabManagerRuntimeState> {
  return new RuntimeStateManager<TabManagerRuntimeState>({
    defaults: DEFAULT_TAB_MANAGER_RUNTIME_STATE,
    key: TAB_MANAGER_RUNTIME_STATE_KEY,
    normalize: normalizeTabManagerRuntimeState,
    warn: debugWarn
  })
}

function serializeTrackedDocuments(): TabManagerRuntimeState {
  const persistedDocuments: PersistedDocumentsByTab = {}

  for (const [tabId, documents] of documentsByTab) {
    if (documents.size === 0) continue

    persistedDocuments[String(tabId)] = [...documents.values()]
  }

  return {
    documentsByTab: persistedDocuments,
    savedAt: Date.now(),
    version: TAB_MANAGER_RUNTIME_STATE_VERSION
  }
}

function flushPendingRuntimeState(): Promise<void> {
  if (!pendingRuntimeState) return Promise.resolve()

  const state = pendingRuntimeState
  pendingRuntimeState = null
  persistScheduled = false

  return runtimeStateManager.save(state)
}

function persistTrackedDocuments(options: { immediate?: boolean } = {}): void {
  pendingRuntimeState = serializeTrackedDocuments()

  if (options.immediate) {
    void flushPendingRuntimeState()
    return
  }

  if (persistScheduled) return

  persistScheduled = true
  const generation = persistGeneration
  void Promise.resolve().then(() => {
    if (generation !== persistGeneration) return
    void flushPendingRuntimeState()
  })
}

function getOpenTabIds(): Promise<Set<number> | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      chrome.tabs.query({}, (tabs) => {
        resolve(
          new Set(
            (tabs ?? [])
              .map((tab) => tab.id)
              .filter((tabId): tabId is number => typeof tabId === "number")
          )
        )
      })
    } catch {
      resolve(null)
    }
  })
}

async function restoreTrackedDocuments(): Promise<void> {
  if (documentsRestored) return
  if (restoreDocumentsPromise) return restoreDocumentsPromise

  restoreDocumentsPromise = Promise.all([
    runtimeStateManager.load(),
    getOpenTabIds()
  ])
    .then(([state, openTabIds]) => {
      let prunedStaleDocuments = false

      for (const [tabIdValue, documents] of Object.entries(
        state.documentsByTab
      )) {
        const tabId = Number(tabIdValue)
        if (!Number.isInteger(tabId)) continue
        if (openTabIds && !openTabIds.has(tabId)) {
          prunedStaleDocuments = true
          continue
        }

        let trackedDocuments = documentsByTab.get(tabId)
        if (!trackedDocuments) {
          trackedDocuments = new Map()
          documentsByTab.set(tabId, trackedDocuments)
        }

        for (const document of documents) {
          if (!trackedDocuments.has(document.frameId)) {
            trackedDocuments.set(document.frameId, document)
          }
        }
      }

      documentsRestored = true
      if (prunedStaleDocuments) {
        persistTrackedDocuments()
      }
    })
    .finally(() => {
      restoreDocumentsPromise = null
    })

  return restoreDocumentsPromise
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
  persistTrackedDocuments()
}

function removeDocument(tabId: number, frameId: number): void {
  const documents = documentsByTab.get(tabId)
  if (!documents) return

  documents.delete(frameId)
  if (documents.size === 0) {
    documentsByTab.delete(tabId)
  }
  persistTrackedDocuments({ immediate: true })
}

function messageListener(
  message: unknown,
  sender: chrome.runtime.MessageSender
): boolean {
  if (!isFontaraContentScriptMessage(message)) {
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
  message: FontaraContentCommandMessage,
  onDeliveryFailure?: () => void
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
      onDeliveryFailure?.()
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
  message: FontaraContentCommandMessage,
  onDeliveryFailure?: () => void
): void {
  sendDocumentMessage(
    tabId,
    document,
    {
      ...message,
      scriptId: document.scriptId
    },
    onDeliveryFailure
  )
}

function sendDocumentMessageFromFactory(
  tabId: number,
  document: FontaraTrackedDocument,
  factory: DocumentMessageFactory,
  onDeliveryFailure?: () => void
): void {
  try {
    const message = factory(document)

    if (!isPromiseLikeMessage(message)) {
      sendResolvedDocumentMessage(tabId, document, message, onDeliveryFailure)
      return
    }

    void message
      .catch(() => createSettingsChangedMessage())
      .then((resolvedMessage) => {
        sendResolvedDocumentMessage(
          tabId,
          document,
          resolvedMessage,
          onDeliveryFailure
        )
      })
  } catch {
    sendResolvedDocumentMessage(
      tabId,
      document,
      createSettingsChangedMessage(),
      onDeliveryFailure
    )
  }
}

export function initTabManager(options: TabManagerOptions = {}): void {
  if (options.createDocumentMessage) {
    createDocumentMessage = options.createDocumentMessage
  }

  void restoreTrackedDocuments()

  if (initialized) return

  chrome.runtime.onMessage.addListener(messageListener)
  chrome.tabs.onRemoved.addListener((tabId) => {
    documentsByTab.delete(tabId)
    persistTrackedDocuments({ immediate: true })
  })
  initialized = true
}

export async function notifyContentScriptsAboutSettingsChange(
  factory: DocumentMessageFactory = createDocumentMessage ??
    createSettingsChangedMessage
): Promise<void> {
  await restoreTrackedDocuments()

  const trackedTabIds = new Set<number>()
  const broadcastedTrackedTabIds = new Set<number>()
  const broadcastSettingsChangedToTrackedTab = (tabId: number): void => {
    if (broadcastedTrackedTabIds.has(tabId)) return

    broadcastedTrackedTabIds.add(tabId)
    sendSettingsChangedMessageToTab(tabId)
  }

  for (const [tabId, documents] of documentsByTab) {
    trackedTabIds.add(tabId)
    for (const document of documents.values()) {
      sendDocumentMessageFromFactory(tabId, document, factory, () => {
        broadcastSettingsChangedToTrackedTab(tabId)
      })
    }
    broadcastSettingsChangedToTrackedTab(tabId)
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

export function resetTabManagerStateForTesting(): void {
  documentsByTab.clear()
  initialized = false
  createDocumentMessage = null
  runtimeStateManager = createRuntimeStateManager()
  restoreDocumentsPromise = null
  documentsRestored = false
  pendingRuntimeState = null
  persistScheduled = false
  persistGeneration += 1
}
