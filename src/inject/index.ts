import { STORAGE_KEYS } from "../config/storage"
import type { FontaraContentScriptMessage } from "../definitions"
import {
  MESSAGE_TYPES_BG_TO_CS,
  MESSAGE_TYPES_CS_TO_BG
} from "../utils/message"
import { watchLocalStorage } from "../utils/storage"
import { getUrlActivationState } from "../utils/url"
import { applyFontToTreeChunked, resetProcessedElements } from "./dom-processor"
import { injectFontStyles, removeFontStyles } from "./font-style-manager"
import { startObserving, stopObserving } from "./observer"
import {
  cleanupRtlSupport,
  pauseRtlSupport,
  scheduleApplyRtlIfActive
} from "./rtl"
import {
  injectTextStrokeStyle,
  removeTextStrokeStyle
} from "./text-stroke-style"

type ApplyMode = "font-styles" | "full"
type RuntimeMessageEvent = typeof chrome.runtime.onMessage
type RuntimeControlMessage = {
  action?: string
  scriptId?: string
  type?: string
}

const scriptId = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2)}`

let disposed = false
let applyFontsQueuedMode: ApplyMode | null = null
let applyFontsRunning = false
let applyFontsScheduledMode: ApplyMode | null = null
let runtimeMessageEvent: RuntimeMessageEvent | null = null
let stopWatchingStorage: (() => void) | null = null
let stopWatchingUrlChanges: (() => void) | null = null
let stopWaitingForBody: (() => void) | null = null

function mergeApplyMode(
  currentMode: ApplyMode | null,
  nextMode: ApplyMode
): ApplyMode {
  return currentMode === "full" || nextMode === "full" ? "full" : "font-styles"
}

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

function isExtensionContextInvalidated(error: unknown): boolean {
  return /extension context invalidated|context invalidated/i.test(
    getErrorMessage(error)
  )
}

function isExpectedRuntimeTeardownError(error: unknown): boolean {
  return (
    isExtensionContextInvalidated(error) ||
    /Cannot read (?:properties|property) of undefined \(reading 'onMessage'\)/i.test(
      getErrorMessage(error)
    )
  )
}

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
  }
}

function getRuntimeMessageEvent(): RuntimeMessageEvent | null {
  if (typeof chrome === "undefined") return null

  return chrome.runtime?.onMessage ?? null
}

function isTopFrame(): boolean {
  try {
    return window === window.top
  } catch {
    return false
  }
}

function sendDocumentLifecycleMessage(
  type:
    | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT
    | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET
    | typeof MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME
): void {
  if (disposed) return

  const message: FontaraContentScriptMessage = {
    data: {
      isTopFrame: isTopFrame(),
      url: window.location.href
    },
    scriptId,
    type
  }

  try {
    const runtime = chrome.runtime
    if (!runtime || typeof runtime.sendMessage !== "function") {
      return
    }

    runtime.sendMessage(message, () => {
      const error = chrome.runtime?.lastError
      if (error && isExtensionContextInvalidated(error)) {
        cleanupRuntimeListeners({ removeStyles: true })
      }
    })
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      cleanupRuntimeListeners({ removeStyles: true })
      return
    }
    debugWarn("Failed to send FontAra document lifecycle message.", error)
  }
}

function runWhenBodyIsReady(callback: () => void | Promise<void>): () => void {
  if (document.body) {
    void callback()
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (!document.body) return

    observer.disconnect()
    void callback()
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  return () => observer.disconnect()
}

function watchUrlChanges(callback: () => void): () => void {
  let currentUrl = window.location.href

  const handlePossibleUrlChange = (): void => {
    const nextUrl = window.location.href
    if (nextUrl === currentUrl) return

    currentUrl = nextUrl
    callback()
  }

  const scheduleUrlCheck = (): void => {
    queueMicrotask(handlePossibleUrlChange)
  }

  const cleanupCallbacks: Array<() => void> = []
  const historyObject = window.history

  const wrapHistoryMethod = (methodName: "pushState" | "replaceState") => {
    const originalMethod = historyObject[methodName]
    const wrappedMethod: typeof history.pushState = function (
      this: History,
      ...args: Parameters<typeof history.pushState>
    ) {
      const result = originalMethod.apply(this, args)
      scheduleUrlCheck()
      return result
    }

    try {
      historyObject[methodName] = wrappedMethod
      cleanupCallbacks.push(() => {
        if (historyObject[methodName] === wrappedMethod) {
          historyObject[methodName] = originalMethod
        }
      })
    } catch (error) {
      debugWarn(`Failed to watch history.${methodName}.`, error)
    }
  }

  wrapHistoryMethod("pushState")
  wrapHistoryMethod("replaceState")

  addEventListener("popstate", scheduleUrlCheck)
  addEventListener("hashchange", scheduleUrlCheck)
  cleanupCallbacks.push(() => {
    removeEventListener("popstate", scheduleUrlCheck)
    removeEventListener("hashchange", scheduleUrlCheck)
  })

  if (typeof window.setInterval === "function") {
    const intervalId = window.setInterval(handlePossibleUrlChange, 1000)
    cleanupCallbacks.push(() => window.clearInterval(intervalId))
  }

  return () => {
    for (const cleanup of cleanupCallbacks.reverse()) {
      cleanup()
    }
  }
}

async function applyFontsIfActive(mode: ApplyMode): Promise<void> {
  if (disposed) return

  try {
    const activationState = await getUrlActivationState(window.location.href)

    if (!activationState.active) {
      stopObserving()
      resetProcessedElements()
      removeFontStyles()
      removeTextStrokeStyle()
      return
    }

    await injectTextStrokeStyle(
      activationState.matchingWebsite,
      activationState.siteProfile
    )
    const hasCustomCSS = await injectFontStyles(
      activationState.matchingWebsite,
      activationState.siteProfile
    )

    if (hasCustomCSS) {
      stopObserving()
      resetProcessedElements()
      return
    }

    if (mode === "full" && document.body) {
      applyFontToTreeChunked(document.body)
    }

    if (document.body) {
      startObserving()
    }
  } catch (error) {
    stopObserving()
    if (isExtensionContextInvalidated(error)) {
      cleanupRuntimeListeners({ removeStyles: true })
      return
    }
    debugWarn("Failed to apply FontAra styles.", error)
  }
}

async function runScheduledApplyFontsIfActive(mode: ApplyMode): Promise<void> {
  if (applyFontsRunning) {
    applyFontsQueuedMode = mergeApplyMode(applyFontsQueuedMode, mode)
    return
  }

  applyFontsRunning = true
  let currentMode: ApplyMode | null = mode
  try {
    while (currentMode && !disposed) {
      const modeToRun = currentMode
      currentMode = null
      applyFontsQueuedMode = null
      await applyFontsIfActive(modeToRun)
      currentMode = applyFontsQueuedMode
    }
  } finally {
    applyFontsRunning = false
  }
}

function scheduleApplyFontsIfActive(mode: ApplyMode = "full"): void {
  if (disposed) return

  if (applyFontsRunning) {
    applyFontsQueuedMode = mergeApplyMode(applyFontsQueuedMode, mode)
    return
  }

  const alreadyScheduled = applyFontsScheduledMode !== null
  applyFontsScheduledMode = mergeApplyMode(applyFontsScheduledMode, mode)
  if (alreadyScheduled) return

  queueMicrotask(() => {
    const scheduledMode = applyFontsScheduledMode
    applyFontsScheduledMode = null

    if (!disposed && scheduledMode) {
      void runScheduledApplyFontsIfActive(scheduledMode)
    }
  })
}

stopWaitingForBody = runWhenBodyIsReady(() => {
  scheduleApplyFontsIfActive()
  scheduleApplyRtlIfActive()
})

stopWatchingStorage = watchLocalStorage({
  [STORAGE_KEYS.SELECTED_FONT]: () => scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.EXTENSION_ENABLED]: () => {
    scheduleApplyFontsIfActive()
    scheduleApplyRtlIfActive()
  },
  [STORAGE_KEYS.ENABLED_BY_DEFAULT]: () => scheduleApplyFontsIfActive(),
  [STORAGE_KEYS.ENABLED_FOR]: () => scheduleApplyFontsIfActive(),
  [STORAGE_KEYS.DISABLED_FOR]: () => scheduleApplyFontsIfActive(),
  [STORAGE_KEYS.SITE_PROFILES]: () => scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.WEBSITE_LIST]: () => scheduleApplyFontsIfActive(),
  [STORAGE_KEYS.CUSTOM_FONT_LIST]: () =>
    scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: () =>
    scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.GOOGLE_FONTS_ENABLED]: () =>
    scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.TEXT_STROKE]: () => scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.RTL_ENABLED]: () => scheduleApplyRtlIfActive(),
  [STORAGE_KEYS.RTL_SITE_SETTINGS]: () => scheduleApplyRtlIfActive()
})

stopWatchingUrlChanges = watchUrlChanges(() => {
  scheduleApplyFontsIfActive()
  scheduleApplyRtlIfActive()
})

function handleRuntimeMessage(message: RuntimeControlMessage): void {
  if (
    message?.type === MESSAGE_TYPES_BG_TO_CS.SETTINGS_CHANGED &&
    (!message.scriptId || message.scriptId === scriptId)
  ) {
    scheduleApplyFontsIfActive()
    scheduleApplyRtlIfActive()
    return
  }

  if (message?.action === "toggle" || message?.action === "toggleExtension") {
    scheduleApplyFontsIfActive()
    scheduleApplyRtlIfActive()
  }
}

function cleanupRuntimeListeners(
  options: { removeStyles?: boolean } = {}
): void {
  if (disposed) return

  disposed = true
  applyFontsQueuedMode = null
  applyFontsScheduledMode = null
  stopWaitingForBody?.()
  stopWaitingForBody = null
  stopObserving()
  if (options.removeStyles) {
    resetProcessedElements()
    removeFontStyles()
    removeTextStrokeStyle()
  }
  cleanupRtlSupport()
  stopWatchingStorage?.()
  stopWatchingStorage = null
  stopWatchingUrlChanges?.()
  stopWatchingUrlChanges = null
  const messageEvent = runtimeMessageEvent ?? getRuntimeMessageEvent()
  runtimeMessageEvent = null
  try {
    messageEvent?.removeListener(handleRuntimeMessage)
  } catch (error) {
    if (!isExpectedRuntimeTeardownError(error)) {
      debugWarn("Failed to remove FontAra runtime message listener.", error)
    }
  }
  removeEventListener("pagehide", handlePageHide)
  removeEventListener("pageshow", handlePageShow)
  removeEventListener("freeze", handleFreeze)
  removeEventListener("resume", handleResume)
}

function handlePageHide(event: PageTransitionEvent): void {
  stopObserving()
  pauseRtlSupport()

  if (!event.persisted) {
    sendDocumentLifecycleMessage(MESSAGE_TYPES_CS_TO_BG.DOCUMENT_FORGET)
    cleanupRuntimeListeners()
  }
}

function handlePageShow(event: PageTransitionEvent): void {
  if (event.persisted) {
    scheduleApplyFontsIfActive()
    scheduleApplyRtlIfActive()
  }
}

function handleFreeze(): void {
  stopObserving()
  pauseRtlSupport()
}

function handleResume(): void {
  sendDocumentLifecycleMessage(MESSAGE_TYPES_CS_TO_BG.DOCUMENT_RESUME)
  scheduleApplyFontsIfActive()
  scheduleApplyRtlIfActive()
}

try {
  const messageEvent = getRuntimeMessageEvent()
  if (!messageEvent) {
    throw new TypeError(
      "Cannot read properties of undefined (reading 'onMessage')"
    )
  }
  messageEvent.addListener(handleRuntimeMessage)
  runtimeMessageEvent = messageEvent
} catch (error) {
  cleanupRuntimeListeners({ removeStyles: true })
  if (!isExpectedRuntimeTeardownError(error)) {
    debugWarn("Failed to register FontAra runtime message listener.", error)
  }
}

if (!disposed) {
  sendDocumentLifecycleMessage(MESSAGE_TYPES_CS_TO_BG.DOCUMENT_CONNECT)
  addEventListener("pagehide", handlePageHide)
  addEventListener("pageshow", handlePageShow)
  addEventListener("freeze", handleFreeze)
  addEventListener("resume", handleResume)
}
