import type {
  FontaraContentCommandMessage,
  FontaraContentScriptMessage
} from "../definitions"
import { MESSAGE_TYPES_CS_TO_BG } from "../utils/message"
import { getRelatedFrameRuntimePageURL } from "../utils/runtime-url"

export type RuntimeMessageEvent = typeof chrome.runtime.onMessage
export type RuntimeControlMessage = Partial<FontaraContentCommandMessage> & {
  action?: string
  scriptId?: string
  type?: string
}

type DocumentLifecycleMessageType =
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME
  | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_UPDATE

type RuntimeWarningHandler = (message: string, error: unknown) => void

type DocumentLifecycleMessageOptions = {
  isDisposed: () => boolean
  onExtensionContextInvalidated: () => void
  scriptId: string
  warn?: RuntimeWarningHandler
}

const DOCUMENT_LIFECYCLE_SEND_MAX_RETRIES = 4
const DOCUMENT_LIFECYCLE_SEND_RETRY_MS = 250
const latestLifecycleRequests = new WeakMap<
  DocumentLifecycleMessageOptions,
  symbol
>()

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return String(error)
}

export function isExtensionContextInvalidated(error: unknown): boolean {
  return /extension context invalidated|context invalidated/i.test(
    getErrorMessage(error)
  )
}

export function isExpectedRuntimeTeardownError(error: unknown): boolean {
  return (
    isExtensionContextInvalidated(error) ||
    /Cannot read (?:properties|property) of undefined \(reading 'onMessage'\)/i.test(
      getErrorMessage(error)
    )
  )
}

export function isTransientRuntimeSendError(error: unknown): boolean {
  return /Could not establish connection|Receiving end does not exist|message port closed/i.test(
    getErrorMessage(error)
  )
}

export function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

export function getRuntimeMessageEvent(): RuntimeMessageEvent | null {
  if (typeof chrome === "undefined") return null

  return chrome.runtime?.onMessage ?? null
}

export function sendDocumentLifecycleMessage(
  type: DocumentLifecycleMessageType,
  options: DocumentLifecycleMessageOptions
): boolean {
  if (options.isDisposed()) return false

  const request = Symbol()
  latestLifecycleRequests.set(options, request)
  const isCurrentRequest = (): boolean =>
    !options.isDisposed() && latestLifecycleRequests.get(options) === request

  const relatedPageURL = getRelatedFrameRuntimePageURL()
  const message: FontaraContentScriptMessage = {
    ...(relatedPageURL ? { pageURL: relatedPageURL } : {}),
    scriptId: options.scriptId,
    type
  }

  function handleSendError(error: unknown, attempt: number): void {
    if (!isCurrentRequest()) return
    if (isExtensionContextInvalidated(error)) {
      options.onExtensionContextInvalidated()
      return
    }

    if (isTransientRuntimeSendError(error)) {
      // A delayed FORGET could unregister a document that has since resumed.
      if (
        type !== MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET &&
        attempt < DOCUMENT_LIFECYCLE_SEND_MAX_RETRIES
      ) {
        window.setTimeout(
          () => attemptSend(attempt + 1),
          DOCUMENT_LIFECYCLE_SEND_RETRY_MS
        )
      }
      return
    }

    options.warn?.("Failed to send FontAra document lifecycle message.", error)
  }

  function attemptSend(attempt = 0): boolean {
    if (!isCurrentRequest()) return false

    try {
      const runtime = typeof chrome === "undefined" ? undefined : chrome.runtime
      if (!runtime || typeof runtime.sendMessage !== "function") return false

      runtime.sendMessage(message, () => {
        const error = runtime.lastError
        if (error) handleSendError(error, attempt)
      })
      return true
    } catch (error) {
      handleSendError(error, attempt)
      return false
    }
  }

  return attemptSend()
}
