import type {
  CustomFontFamilyDraft,
  CustomFontTransactionBeginResult,
  CustomFontTransactionCommitResult,
  CustomFontTransactionMode
} from "../custom-font-types"
import type {
  FontaraExtensionData,
  FontaraGoogleFontCacheStats,
  FontaraGoogleFontPrepareResult,
  FontaraImportedSettingsResult,
  FontaraMessageResponse,
  FontaraSettings,
  FontaraSettingsMutationResult,
  FontaraUIMessage
} from "../definitions"
import { isFontaraBrowserTestRelayMessage } from "../utils/browser-test-bridge"
import {
  createFontaraBackgroundChangesMessage,
  createFontaraMessageErrorResponse,
  createFontaraMessageResponse,
  isFontaraUIMessage,
  MESSAGE_TYPES_UI_TO_BG
} from "../utils/message"

export type FontaraMessengerAdapter = {
  abortCustomFontTransaction(transactionId: string): Promise<void>
  beginCustomFontTransaction(
    family: CustomFontFamilyDraft,
    mode?: CustomFontTransactionMode
  ): Promise<CustomFontTransactionBeginResult>
  changeSettings(
    settings: FontaraSettings
  ): Promise<FontaraSettingsMutationResult>
  collect(): Promise<FontaraExtensionData>
  commitCustomFontTransaction(
    transactionId: string
  ): Promise<CustomFontTransactionCommitResult>
  importCustomFontBatch(
    transactionIds: string[],
    settings: FontaraSettings
  ): Promise<FontaraImportedSettingsResult>
  deleteCustomFont(familyValue: string): Promise<FontaraSettingsMutationResult>
  importSettings(
    settings: FontaraSettings
  ): Promise<FontaraImportedSettingsResult>
  resetSettings(): Promise<FontaraSettingsMutationResult>
  runCommand(command: string, details?: { url?: string | null }): Promise<void>
  putCustomFontFace(
    transactionId: string,
    faceId: string,
    base64: string
  ): Promise<void>
  prepareGoogleFont(
    selectedValue: string
  ): Promise<FontaraGoogleFontPrepareResult>
  clearGoogleFontCache(): Promise<FontaraGoogleFontCacheStats>
  getGoogleFontCacheStats(): Promise<FontaraGoogleFontCacheStats>
}

type SendResponse = (response: FontaraMessageResponse) => void

const ALLOWED_UI_PAGE_PATHS = [
  "ui/options/index.html",
  "ui/popup/index.html"
] as const

let adapter: FontaraMessengerAdapter | null = null
let initialized = false
let subscriberCount = 0
const pendingMutations = new Map<string, Promise<unknown>>()
const completedMutations = new Map<string, unknown>()
const MAX_COMPLETED_MUTATIONS = 128

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getRuntimeURL(path: string): string | null {
  try {
    return chrome.runtime.getURL(path)
  } catch {
    return null
  }
}

function matchesAllowedURL(senderURL: string, allowedURL: string): boolean {
  return (
    senderURL === allowedURL ||
    senderURL.startsWith(`${allowedURL}?`) ||
    senderURL.startsWith(`${allowedURL}#`)
  )
}

function isAllowedUIMessageSender(
  sender: chrome.runtime.MessageSender
): boolean {
  if (typeof sender.url !== "string") {
    return false
  }

  return ALLOWED_UI_PAGE_PATHS.some((path) => {
    const allowedURL = getRuntimeURL(path)
    return allowedURL
      ? matchesAllowedURL(sender.url as string, allowedURL)
      : false
  })
}

function isContentScriptSender(sender: chrome.runtime.MessageSender): boolean {
  if (typeof sender.tab?.id !== "number" || typeof sender.url !== "string") {
    return false
  }

  try {
    const url = new URL(sender.url)
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1")
    )
  } catch {
    return false
  }
}

async function handleMessage(message: FontaraUIMessage): Promise<unknown> {
  if (!adapter) {
    throw new Error("fontara-messenger-not-ready")
  }

  switch (message.type) {
    case MESSAGE_TYPES_UI_TO_BG.GET_DATA:
      return adapter.collect()
    case MESSAGE_TYPES_UI_TO_BG.SUBSCRIBE_TO_CHANGES:
      subscriberCount += 1
      return adapter.collect()
    case MESSAGE_TYPES_UI_TO_BG.UNSUBSCRIBE_FROM_CHANGES:
      subscriberCount = Math.max(0, subscriberCount - 1)
      return true
    case MESSAGE_TYPES_UI_TO_BG.CHANGE_SETTINGS:
      return adapter.changeSettings(message.data.settings)
    case MESSAGE_TYPES_UI_TO_BG.IMPORT_SETTINGS:
      return adapter.importSettings(message.data.settings)
    case MESSAGE_TYPES_UI_TO_BG.RESET_SETTINGS:
      return adapter.resetSettings()
    case MESSAGE_TYPES_UI_TO_BG.RUN_COMMAND:
      await adapter.runCommand(message.data.command, { url: message.data.url })
      return true
    case MESSAGE_TYPES_UI_TO_BG.CUSTOM_FONT_BEGIN:
      return adapter.beginCustomFontTransaction(
        message.data.family,
        message.data.mode
      )
    case MESSAGE_TYPES_UI_TO_BG.CUSTOM_FONT_PUT_FACE:
      await adapter.putCustomFontFace(
        message.data.transactionId,
        message.data.faceId,
        message.data.base64
      )
      return true
    case MESSAGE_TYPES_UI_TO_BG.CUSTOM_FONT_COMMIT:
      return adapter.commitCustomFontTransaction(message.data.transactionId)
    case MESSAGE_TYPES_UI_TO_BG.CUSTOM_FONT_IMPORT_BATCH:
      return adapter.importCustomFontBatch(
        message.data.transactionIds,
        message.data.settings
      )
    case MESSAGE_TYPES_UI_TO_BG.CUSTOM_FONT_ABORT:
      await adapter.abortCustomFontTransaction(message.data.transactionId)
      return true
    case MESSAGE_TYPES_UI_TO_BG.CUSTOM_FONT_DELETE:
      return adapter.deleteCustomFont(message.data.familyValue)
    case MESSAGE_TYPES_UI_TO_BG.GOOGLE_FONT_PREPARE:
      return adapter.prepareGoogleFont(message.data.selectedValue)
    case MESSAGE_TYPES_UI_TO_BG.GOOGLE_FONT_CACHE_CLEAR:
      return adapter.clearGoogleFontCache()
    case MESSAGE_TYPES_UI_TO_BG.GOOGLE_FONT_CACHE_STATS:
      return adapter.getGoogleFontCacheStats()
  }
}

function getClientMutationId(message: FontaraUIMessage): string | null {
  if (!("data" in message) || !("clientMutationId" in message.data)) {
    return null
  }
  return message.data.clientMutationId
}

function rememberCompletedMutation(id: string, result: unknown): void {
  completedMutations.set(id, result)
  if (completedMutations.size <= MAX_COMPLETED_MUTATIONS) return

  const oldestId = completedMutations.keys().next().value
  if (typeof oldestId === "string") completedMutations.delete(oldestId)
}

function getMutationCacheKey(
  message: FontaraUIMessage,
  sender: chrome.runtime.MessageSender
): string | null {
  const clientMutationId = getClientMutationId(message)
  if (!clientMutationId) return null

  // UI pages and the test bridge can have independent mutation-id generators.
  // Scope the cache so an options page, popup, tab, or frame cannot consume an
  // unrelated operation that happens to reuse the same id.
  const senderScope = [
    sender.id ?? "",
    sender.url ?? "",
    sender.tab?.id ?? "",
    sender.frameId ?? "",
    sender.documentId ?? ""
  ].join("\u0000")
  return `${senderScope}\u0000${message.type}\u0000${clientMutationId}`
}

/**
 * Deduplicates UI retries while this service-worker instance is alive.
 * Durable custom-font commits remain independently idempotent in storage, so
 * this primarily protects begin/put/delete and ordinary settings mutations
 * from a duplicated browser message or UI retry.
 */
function handleMessageIdempotently(
  message: FontaraUIMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  const mutationCacheKey = getMutationCacheKey(message, sender)
  if (!mutationCacheKey) return handleMessage(message)
  if (completedMutations.has(mutationCacheKey)) {
    return Promise.resolve(completedMutations.get(mutationCacheKey))
  }

  const pending = pendingMutations.get(mutationCacheKey)
  if (pending) return pending

  const operation = handleMessage(message).then((result) => {
    rememberCompletedMutation(mutationCacheKey, result)
    return result
  })
  pendingMutations.set(mutationCacheKey, operation)
  const cleanUpPendingOperation = () => {
    if (pendingMutations.get(mutationCacheKey) === operation) {
      pendingMutations.delete(mutationCacheKey)
    }
  }
  // Promise.prototype.finally() would create a second rejected promise when
  // the operation fails. A two-branch then keeps cleanup handled explicitly.
  void operation.then(cleanUpPendingOperation, cleanUpPendingOperation)
  return operation
}

function messageListener(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse
): boolean {
  if (
    typeof __TEST__ !== "undefined" &&
    __TEST__ &&
    isContentScriptSender(sender) &&
    isFontaraBrowserTestRelayMessage(message)
  ) {
    void handleMessageIdempotently(message.data.message, sender)
      .then((data) => sendResponse(createFontaraMessageResponse(data)))
      .catch((error) =>
        sendResponse(createFontaraMessageErrorResponse(getErrorMessage(error)))
      )

    return true
  }

  if (!isFontaraUIMessage(message) || !isAllowedUIMessageSender(sender)) {
    return false
  }

  void handleMessageIdempotently(message, sender)
    .then((data) => sendResponse(createFontaraMessageResponse(data)))
    .catch((error) =>
      sendResponse(createFontaraMessageErrorResponse(getErrorMessage(error)))
    )

  return true
}

export function initMessenger(nextAdapter: FontaraMessengerAdapter): void {
  adapter = nextAdapter

  if (initialized) return

  chrome.runtime.onMessage.addListener(messageListener)
  initialized = true
}

export function reportChanges(data: FontaraExtensionData): void {
  if (subscriberCount === 0) return

  chrome.runtime.sendMessage(createFontaraBackgroundChangesMessage(data))
}
