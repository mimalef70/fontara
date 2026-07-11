import {
  createFontaraBrowserTestPageErrorResponse,
  createFontaraBrowserTestPageResponse,
  createFontaraBrowserTestRelayMessage,
  isFontaraBrowserTestPagePing,
  isFontaraBrowserTestPageRequest
} from "../utils/browser-test-bridge"

let started = false

function isTestBuild(): boolean {
  return typeof __TEST__ !== "undefined" && __TEST__
}

function isLocalTestPage(): boolean {
  if (typeof window === "undefined") return false

  return (
    (window.location.protocol === "http:" ||
      window.location.protocol === "https:") &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1")
  )
}

function postBridgeResponse(response: unknown): void {
  if (typeof window.postMessage !== "function") return

  window.postMessage(response, "*")
}

function handleBridgeMessage(event: MessageEvent): void {
  if (event.source && event.source !== window) return
  if (event.origin !== window.location.origin) return

  if (isFontaraBrowserTestPagePing(event.data)) {
    postBridgeResponse(
      createFontaraBrowserTestPageResponse(event.data.requestId, true)
    )
    return
  }

  if (!isFontaraBrowserTestPageRequest(event.data)) return

  const { message, requestId } = event.data

  try {
    chrome.runtime.sendMessage(
      createFontaraBrowserTestRelayMessage(message),
      (response) => {
        const error = chrome.runtime.lastError
        if (error) {
          postBridgeResponse(
            createFontaraBrowserTestPageErrorResponse(
              requestId,
              error.message ?? "FontARA browser test bridge failed."
            )
          )
          return
        }

        postBridgeResponse(
          createFontaraBrowserTestPageResponse(requestId, response)
        )
      }
    )
  } catch (error) {
    postBridgeResponse(
      createFontaraBrowserTestPageErrorResponse(
        requestId,
        error instanceof Error ? error.message : String(error)
      )
    )
  }
}

export function startContentTestBridge(): void {
  if (!isTestBuild() || !isLocalTestPage() || started) return
  if (
    typeof window === "undefined" ||
    typeof window.addEventListener !== "function" ||
    typeof window.postMessage !== "function"
  ) {
    return
  }

  started = true
  window.addEventListener("message", handleBridgeMessage)
}
