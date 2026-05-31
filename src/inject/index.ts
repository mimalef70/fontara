import { STORAGE_KEYS } from "../config/storage"
import type { WebsiteItem } from "../definitions"
import { watchLocalStorage } from "../utils/storage"
import {
  getMatchingWebsite,
  getStoredWebsiteList,
  isUrlActive
} from "../utils/url"
import { applyFontToTree } from "./dom-processor"
import {
  initializeFontVariable,
  injectFontStyles,
  removeFontStyles,
  updateFontVariable
} from "./font-style-manager"
import { startObserving, stopObserving } from "./observer"

let disposed = false
let stopWatchingStorage: (() => void) | null = null
let stopWaitingForBody: (() => void) | null = null

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

async function applyFontsIfActive(): Promise<void> {
  if (disposed) return

  try {
    const matchingWebsite = await getCurrentWebsite()
    const active = await isUrlActive(window.location.href)

    if (!active) {
      stopObserving()
      removeFontStyles()
      return
    }

    const hasCustomCSS = await injectFontStyles(matchingWebsite)
    await initializeFontVariable()

    if (hasCustomCSS) {
      stopObserving()
      return
    }

    if (document.body) {
      applyFontToTree(document.body)
      startObserving()
    }
  } catch (error) {
    stopObserving()
    if (__DEBUG__) {
      console.warn("Failed to apply FontAra styles.", error)
    }
  }
}

stopWaitingForBody = runWhenBodyIsReady(applyFontsIfActive)

stopWatchingStorage = watchLocalStorage({
  [STORAGE_KEYS.SELECTED_FONT]: (change) => {
    updateFontVariable(change.newValue)
  },
  [STORAGE_KEYS.EXTENSION_ENABLED]: applyFontsIfActive,
  [STORAGE_KEYS.WEBSITE_LIST]: applyFontsIfActive,
  [STORAGE_KEYS.CUSTOM_FONT_LIST]: applyFontsIfActive
})

function handleRuntimeMessage(message: { action?: string }): void {
  if (message?.action === "toggle" || message?.action === "toggleExtension") {
    void applyFontsIfActive()
  }
}

function cleanupRuntimeListeners(): void {
  if (disposed) return

  disposed = true
  stopWaitingForBody?.()
  stopWaitingForBody = null
  stopObserving()
  stopWatchingStorage?.()
  stopWatchingStorage = null
  chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
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
    void applyFontsIfActive()
  }
}

function handleFreeze(): void {
  stopObserving()
}

function handleResume(): void {
  void applyFontsIfActive()
}

chrome.runtime.onMessage.addListener(handleRuntimeMessage)

addEventListener("pagehide", handlePageHide)
addEventListener("pageshow", handlePageShow)
addEventListener("freeze", handleFreeze)
addEventListener("resume", handleResume)
