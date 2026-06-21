import type {
  FontaraContentCommandMessage,
  FontaraContentScriptMessage
} from "../definitions"
import type { MESSAGE_TYPES_CS_TO_BG } from "../utils/message"
import { isTopFrame } from "./content-lifecycle"

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

  const message: FontaraContentScriptMessage = {
    data: {
      isTopFrame: isTopFrame(),
      url: window.location.href
    },
    scriptId: options.scriptId,
    type
  }

  const attemptSend = (attempt = 0): void => {
    if (options.isDisposed()) return

    try {
      const runtime = chrome.runtime
      if (!runtime || typeof runtime.sendMessage !== "function") {
        return
      }

      runtime.sendMessage(message, () => {
        const error = chrome.runtime?.lastError
        if (!error) return

        if (isExtensionContextInvalidated(error)) {
          options.onExtensionContextInvalidated()
          return
        }

        if (
          attempt < DOCUMENT_LIFECYCLE_SEND_MAX_RETRIES &&
          isTransientRuntimeSendError(error)
        ) {
          window.setTimeout(
            () => attemptSend(attempt + 1),
            DOCUMENT_LIFECYCLE_SEND_RETRY_MS
          )
          return
        }

        if (!isTransientRuntimeSendError(error)) {
          options.warn?.(
            "Failed to deliver FontAra document lifecycle message.",
            error
          )
        }
      })
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        options.onExtensionContextInvalidated()
        return
      }
      if (!isTransientRuntimeSendError(error)) {
        options.warn?.(
          "Failed to send FontAra document lifecycle message.",
          error
        )
      }
    }
  }

  try {
    attemptSend()
    return true
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      options.onExtensionContextInvalidated()
      return false
    }
    if (!isTransientRuntimeSendError(error)) {
      options.warn?.(
        "Failed to send FontAra document lifecycle message.",
        error
      )
    }
    return false
  }
}
