import { STORAGE_KEYS } from "../config/storage"
import type { WebsiteItem } from "../definitions"
import { watchLocalStorage } from "../utils/storage"
import {
  getMatchingWebsite,
  getStoredWebsiteList,
  isUrlActive
} from "../utils/url"
import { applyFontToTreeChunked, resetProcessedElements } from "./dom-processor"
import {
  areBaseFontStylesPresent,
  initializeFontVariable,
  injectFontStyles,
  isManagedFontStyleElement,
  removeFontStyles
} from "./font-style-manager"
import { startObserving, stopObserving } from "./observer"

let disposed = false
let applyFontsQueued = false
let applyFontsRunning = false
let applyFontsScheduled = false
let stopWatchingFontStyles: (() => void) | null = null
let stopWatchingStorage: (() => void) | null = null
let stopWaitingForBody: (() => void) | null = null

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

async function getCurrentWebsite(): Promise<WebsiteItem | null> {
  const websiteList = await getStoredWebsiteList()
  return getMatchingWebsite(window.location.href, websiteList)
}

function getFontStyleHost(): HTMLElement {
  return document.head || document.documentElement
}

function shouldRestoreFontStyles(mutations: MutationRecord[]): boolean {
  if (!areBaseFontStylesPresent()) return true

  return mutations.some((mutation) =>
    Array.from(mutation.removedNodes).some(isManagedFontStyleElement)
  )
}

function startWatchingFontStyles(): void {
  stopWatchingFontStyles?.()

  const host = getFontStyleHost()
  const observers: MutationObserver[] = []
  const watchHost = () => {
    if (disposed) return

    if (getFontStyleHost() !== host) {
      startWatchingFontStyles()
      scheduleApplyFontsIfActive()
    }
  }
  const restoreMissingStyles = (mutations: MutationRecord[]) => {
    if (disposed) return

    if (shouldRestoreFontStyles(mutations)) {
      scheduleApplyFontsIfActive()
    }
  }
  const hostObserver = new MutationObserver(restoreMissingStyles)

  hostObserver.observe(host, { childList: true })
  observers.push(hostObserver)

  if (host !== document.documentElement) {
    const documentElementObserver = new MutationObserver(watchHost)
    documentElementObserver.observe(document.documentElement, {
      childList: true
    })
    observers.push(documentElementObserver)
  }

  stopWatchingFontStyles = () => {
    for (const observer of observers) {
      observer.disconnect()
    }
  }
}

async function applyFontsIfActive(): Promise<void> {
  if (disposed) return

  try {
    const matchingWebsite = await getCurrentWebsite()
    const active = await isUrlActive(window.location.href)

    if (!active) {
      stopObserving()
      stopWatchingFontStyles?.()
      stopWatchingFontStyles = null
      resetProcessedElements()
      removeFontStyles()
      return
    }

    const hasCustomCSS = await injectFontStyles(matchingWebsite)
    await initializeFontVariable()
    startWatchingFontStyles()

    if (hasCustomCSS) {
      stopObserving()
      return
    }

    if (document.body) {
      applyFontToTreeChunked(document.body)
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

async function runScheduledApplyFontsIfActive(): Promise<void> {
  if (applyFontsRunning) {
    applyFontsQueued = true
    return
  }

  applyFontsRunning = true
  try {
    do {
      applyFontsQueued = false
      await applyFontsIfActive()
    } while (applyFontsQueued && !disposed)
  } finally {
    applyFontsRunning = false
  }
}

function scheduleApplyFontsIfActive(): void {
  if (disposed) return

  if (applyFontsRunning) {
    applyFontsQueued = true
    return
  }

  if (applyFontsScheduled) return

  applyFontsScheduled = true
  queueMicrotask(() => {
    applyFontsScheduled = false
    if (!disposed) {
      void runScheduledApplyFontsIfActive()
    }
  })
}

stopWaitingForBody = runWhenBodyIsReady(scheduleApplyFontsIfActive)

stopWatchingStorage = watchLocalStorage({
  [STORAGE_KEYS.SELECTED_FONT]: scheduleApplyFontsIfActive,
  [STORAGE_KEYS.EXTENSION_ENABLED]: scheduleApplyFontsIfActive,
  [STORAGE_KEYS.WEBSITE_LIST]: scheduleApplyFontsIfActive,
  [STORAGE_KEYS.CUSTOM_FONT_LIST]: scheduleApplyFontsIfActive
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
  applyFontsQueued = false
  applyFontsScheduled = false
  stopWaitingForBody?.()
  stopWaitingForBody = null
  stopObserving()
  stopWatchingFontStyles?.()
  stopWatchingFontStyles = null
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
