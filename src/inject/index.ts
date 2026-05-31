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

function runWhenBodyIsReady(callback: () => void | Promise<void>): void {
  if (document.body) {
    void callback()
    return
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
}

async function getCurrentWebsite(): Promise<WebsiteItem | null> {
  const websiteList = await getStoredWebsiteList()
  return getMatchingWebsite(window.location.href, websiteList)
}

async function applyFontsIfActive(): Promise<void> {
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
}

runWhenBodyIsReady(applyFontsIfActive)

watchLocalStorage({
  [STORAGE_KEYS.SELECTED_FONT]: (change) => {
    updateFontVariable(change.newValue)
  },
  [STORAGE_KEYS.EXTENSION_ENABLED]: applyFontsIfActive,
  [STORAGE_KEYS.WEBSITE_LIST]: applyFontsIfActive,
  [STORAGE_KEYS.CUSTOM_FONT_LIST]: applyFontsIfActive
})

chrome.runtime.onMessage.addListener((message) => {
  if (message?.action === "toggle" || message?.action === "toggleExtension") {
    void applyFontsIfActive()
  }
})

addEventListener("pagehide", () => {
  stopObserving()
})
