import {
  createFontaraBrowserTestPageErrorResponse,
  createFontaraBrowserTestPageResponse,
  createFontaraBrowserTestRelayMessage,
  isFontaraBrowserTestPagePing,
  isFontaraBrowserTestPageRequest
} from "../utils/browser-test-bridge"

let started = false

function isDebugBuild(): boolean {
  return typeof __DEBUG__ !== "undefined" && __DEBUG__
}

function postBridgeResponse(response: unknown): void {
  if (typeof window.postMessage !== "function") return

  window.postMessage(response, "*")
}

function handleBridgeMessage(event: MessageEvent): void {
  if (event.source && event.source !== window) return

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
  if (!isDebugBuild() || started) return
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
