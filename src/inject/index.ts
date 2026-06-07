import { STORAGE_KEYS } from "../config/storage"
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

type ApplyMode = "font-styles" | "full"
type RuntimeMessageEvent = typeof chrome.runtime.onMessage

let disposed = false
let applyFontsQueuedMode: ApplyMode | null = null
let applyFontsRunning = false
let applyFontsScheduledMode: ApplyMode | null = null
let runtimeMessageEvent: RuntimeMessageEvent | null = null
let stopWatchingStorage: (() => void) | null = null
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

async function applyFontsIfActive(mode: ApplyMode): Promise<void> {
  if (disposed) return

  try {
    const activationState = await getUrlActivationState(window.location.href)

    if (!activationState.active) {
      stopObserving()
      resetProcessedElements()
      removeFontStyles()
      return
    }

    const hasCustomCSS = await injectFontStyles(activationState.matchingWebsite)

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
  [STORAGE_KEYS.WEBSITE_LIST]: () => scheduleApplyFontsIfActive(),
  [STORAGE_KEYS.CUSTOM_FONT_LIST]: () =>
    scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.SYSTEM_FONTS_ENABLED]: () =>
    scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.RTL_ENABLED]: () => scheduleApplyRtlIfActive(),
  [STORAGE_KEYS.RTL_SITE_SETTINGS]: () => scheduleApplyRtlIfActive()
})

function handleRuntimeMessage(message: { action?: string }): void {
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
  }
  cleanupRtlSupport()
  stopWatchingStorage?.()
  stopWatchingStorage = null
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
  addEventListener("pagehide", handlePageHide)
  addEventListener("pageshow", handlePageShow)
  addEventListener("freeze", handleFreeze)
  addEventListener("resume", handleResume)
}
