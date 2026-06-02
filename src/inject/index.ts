import { STORAGE_KEYS } from "../config/storage"
import { watchLocalStorage } from "../utils/storage"
import { getUrlActivationState } from "../utils/url"
import { applyFontToTreeChunked, resetProcessedElements } from "./dom-processor"
import { injectFontStyles, removeFontStyles } from "./font-style-manager"
import { startObserving, stopObserving } from "./observer"

type ApplyMode = "font-styles" | "full"

let disposed = false
let applyFontsQueuedMode: ApplyMode | null = null
let applyFontsRunning = false
let applyFontsScheduledMode: ApplyMode | null = null
let stopWatchingStorage: (() => void) | null = null
let stopWaitingForBody: (() => void) | null = null

function mergeApplyMode(
  currentMode: ApplyMode | null,
  nextMode: ApplyMode
): ApplyMode {
  return currentMode === "full" || nextMode === "full" ? "full" : "font-styles"
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isExtensionContextInvalidated(error: unknown): boolean {
  return /extension context invalidated|context invalidated/i.test(
    getErrorMessage(error)
  )
}

function debugWarn(message: string, error: unknown): void {
  if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
    console.warn(message, error)
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

stopWaitingForBody = runWhenBodyIsReady(scheduleApplyFontsIfActive)

stopWatchingStorage = watchLocalStorage({
  [STORAGE_KEYS.SELECTED_FONT]: () => scheduleApplyFontsIfActive("font-styles"),
  [STORAGE_KEYS.EXTENSION_ENABLED]: () => scheduleApplyFontsIfActive(),
  [STORAGE_KEYS.WEBSITE_LIST]: () => scheduleApplyFontsIfActive(),
  [STORAGE_KEYS.CUSTOM_FONT_LIST]: () =>
    scheduleApplyFontsIfActive("font-styles")
})

function handleRuntimeMessage(message: { action?: string }): void {
  if (message?.action === "toggle" || message?.action === "toggleExtension") {
    scheduleApplyFontsIfActive()
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
  stopWatchingStorage?.()
  stopWatchingStorage = null
  try {
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
  } catch (error) {
    debugWarn("Failed to remove FontAra runtime message listener.", error)
  }
  removeEventListener("pagehide", handlePageHide)
  removeEventListener("pageshow", handlePageShow)
  removeEventListener("freeze", handleFreeze)
  removeEventListener("resume", handleResume)
}

function handlePageHide(event: PageTransitionEvent): void {
  stopObserving()

  if (!event.persisted) {
    cleanupRuntimeListeners()
  }
}

function handlePageShow(event: PageTransitionEvent): void {
  if (event.persisted) {
    scheduleApplyFontsIfActive()
  }
}

function handleFreeze(): void {
  stopObserving()
}

function handleResume(): void {
  scheduleApplyFontsIfActive()
}

try {
  chrome.runtime.onMessage.addListener(handleRuntimeMessage)
} catch (error) {
  cleanupRuntimeListeners({ removeStyles: true })
  debugWarn("Failed to register FontAra runtime message listener.", error)
}

if (!disposed) {
  addEventListener("pagehide", handlePageHide)
  addEventListener("pageshow", handlePageShow)
  addEventListener("freeze", handleFreeze)
  addEventListener("resume", handleResume)
}
