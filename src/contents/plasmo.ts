import { Storage } from "@plasmohq/storage"

import { excludedTags, iconClasses } from "~src/utils/constants"
import type { BrowserMessage, MessageResponse, UrlItem } from "~src/utils/types"
import { browserAPI, isCurrentUrlMatched } from "~src/utils/utils"

import {
  getState,
  initializeState,
  setActiveCustomUrls,
  setActivePopularUrls,
  setCurrentFont,
  setExtensionEnabled
} from "../store/fontStore"
import { loadFont, updateRootVariable } from "./plasmoContent/fontFunc"
import { googleFonts, localFonts } from "./plasmoContent/fonts"

const storage = new Storage()

const rootStyle = document.createElement("style")
rootStyle.id = "fontara-root-styles"
document.head.appendChild(rootStyle)

export async function shouldApplyFonts(): Promise<boolean> {
  const state = getState()
  if (!state.isExtensionEnabled) {
    return false
  }

  const storedPopularUrls = await storage.get<UrlItem[]>("popularActiveUrls")
  const storedCustomUrls = await storage.get<UrlItem[]>("customActiveUrls")

  // Update active URLs arrays with latest data
  const popularUrls = storedPopularUrls
    ? storedPopularUrls.filter((item) => item.isActive).map((item) => item.url)
    : ["*://*/*"]
  setActivePopularUrls(popularUrls)

  const customUrls = storedCustomUrls
    ? storedCustomUrls.filter((item) => item.isActive).map((item) => item.url)
    : []
  setActiveCustomUrls(customUrls)

  return isCurrentUrlMatched(popularUrls) || isCurrentUrlMatched(customUrls)
}

async function handleInitialSetup(): Promise<void> {
  try {
    setActivePopularUrls(["*://*/*"])
    setActiveCustomUrls([])

    // Double check our values were set
    const verifyFont = await storage.get("selectedFont")
    const verifyUrls = await storage.get("popularActiveUrls")

    if (!verifyFont || !verifyUrls) {
      throw new Error("Failed to set initial values")
    }
  } catch (error) {}
}

function applyFontToAllElements(): void {
  if (document.body) {
    const state = getState()

    const computedBodyStyle = window.getComputedStyle(document.body)
    let bodyFontFamily = computedBodyStyle.fontFamily

    // Clean up any previous instances of our fonts AND the current font
    const customFonts = [
      ...Object.keys(localFonts),
      ...Object.keys(googleFonts)
    ]
    customFonts.forEach((font) => {
      bodyFontFamily = bodyFontFamily.replace(
        new RegExp(`${font},?\\s*`, "i"),
        ""
      )
    })
    // Also remove the current font name if it exists
    bodyFontFamily = bodyFontFamily.replace(
      new RegExp(`${state.currentFont},?\\s*`, "i"),
      ""
    )

    // Apply to body with CSS variable first, then original fonts as fallback
    document.body.style.setProperty(
      "font-family",
      bodyFontFamily.trim()
        ? `var(--fontara-font), ${bodyFontFamily.trim()} !important`
        : "var(--fontara-font) !important"
    )

    // Process all elements
    getAllElementsWithFontFamily(document.body)
  }
}

export function getAllElementsWithFontFamily(rootNode: HTMLElement): void {
  const state = getState()

  const processNode = (node: HTMLElement) => {
    if (excludedTags.includes(node.tagName.toLowerCase())) {
      return
    }

    const isIcon = iconClasses.some(
      (className) =>
        node.classList.contains(className) ||
        node.closest(`.${className}`) !== null
    )

    const computedStyle = window.getComputedStyle(node)
    let fontFamily = computedStyle.fontFamily

    const isIconFont =
      fontFamily.toLowerCase().includes("fontawesome") ||
      fontFamily.toLowerCase().includes("material") ||
      fontFamily.toLowerCase().includes("icon") ||
      fontFamily.toLowerCase().includes("glyphicon")

    if (!isIcon && !isIconFont) {
      // Clean up any previous instances of our fonts AND the current font
      const customFonts = [
        ...Object.keys(localFonts),
        ...Object.keys(googleFonts)
      ]

      customFonts.forEach((font) => {
        fontFamily = fontFamily.replace(new RegExp(`${font},?\\s*`, "i"), "")
      })

      // Also remove the current font name if it exists
      fontFamily = fontFamily.replace(
        new RegExp(`${state.currentFont},?\\s*`, "i"),
        ""
      )

      // Set font-family with CSS variable first, then original fonts as fallback

      node.style.setProperty(
        "font-family",
        // `var(--fontara-font), ${fontFamily.trim()} `
        fontFamily.trim()
          ? `var(--fontara-font), ${fontFamily.trim()} !important`
          : "var(--fontara-font) !important"
      )
    }

    // Handle Shadow DOM
    if (node.shadowRoot) {
      const shadowWalker = document.createTreeWalker(
        node.shadowRoot,
        NodeFilter.SHOW_ELEMENT
      )
      let shadowNode = shadowWalker.nextNode()
      while (shadowNode) {
        if (shadowNode instanceof HTMLElement) {
          processNode(shadowNode)
        }
        shadowNode = shadowWalker.nextNode()
      }
    }

    // Handle iframes
    if (node instanceof HTMLIFrameElement) {
      try {
        const iframeDoc = node.contentDocument || node.contentWindow?.document
        if (iframeDoc?.body) {
          const iframeWalker = document.createTreeWalker(
            iframeDoc.body,
            NodeFilter.SHOW_ELEMENT
          )
          let iframeNode = iframeWalker.nextNode()
          while (iframeNode) {
            if (iframeNode instanceof HTMLElement) {
              processNode(iframeNode)
            }
            iframeNode = iframeWalker.nextNode()
          }
        }
      } catch (e) {
        // Handle cross-origin iframe errors silently
      }
    }
  }

  if (rootNode) {
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT)
    let node = walker.nextNode()
    while (node) {
      if (node instanceof HTMLElement) {
        processNode(node)
      }
      node = walker.nextNode()
    }
  }
}
function updateFont(fontName: string): void {
  setCurrentFont(fontName)
  loadFont(fontName).then(() => {
    updateRootVariable(fontName)
    applyFontToAllElements()
  })
}

export function resetFontToDefault(): void {
  if (document.body) {
    // Remove the CSS variable definition
    rootStyle.textContent = ""

    const resetElementStyles = (node: HTMLElement) => {
      // Reset font family
      node.style.removeProperty("font-family")
      if (node.style.length === 0) {
        node.removeAttribute("style")
      }

      // Handle Shadow DOM
      if (node.shadowRoot) {
        const shadowElements = node.shadowRoot.querySelectorAll("*")
        shadowElements.forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.removeProperty("font-family")
            if (element.style.length === 0) {
              element.removeAttribute("style")
            }
          }
        })
      }

      // Handle iframes
      if (node instanceof HTMLIFrameElement) {
        try {
          const iframeDoc = node.contentDocument || node.contentWindow?.document
          if (iframeDoc?.body) {
            resetElementStyles(iframeDoc.body)
          }
        } catch (e) {
          // Handle cross-origin iframe errors silently
        }
      }
    }

    // Reset body
    resetElementStyles(document.body)

    // Reset all elements in main document
    const elements = document.querySelectorAll("*")
    elements.forEach((element) => {
      if (element instanceof HTMLElement) {
        resetElementStyles(element)
      }
    })
  }
}

async function initializeFonts(): Promise<void> {
  if (!document.body) return

  const shouldApply = await shouldApplyFonts()

  if (shouldApply) {
    const storedFont = await storage.get<string>("selectedFont")
    const fontName = storedFont || "Estedad"
    setCurrentFont(fontName)
    await loadFont(fontName)
    updateRootVariable(fontName)
    applyFontToAllElements()
  } else {
    resetFontToDefault()
  }
}

async function initialize(): Promise<void> {
  await initializeState()
  await handleInitialSetup()

  const shouldApply = await shouldApplyFonts()

  if (shouldApply && document.body) {
    const storedFont = await storage.get<string>("selectedFont")
    const fontName = storedFont || "Estedad"
    setCurrentFont(fontName)
    await loadFont(fontName)
    updateRootVariable(fontName)
    applyFontToAllElements()
  }

  // Only observe if extension is enabled
  const state = getState()
  if (state.isExtensionEnabled) {
    observer.observe(document.body, { childList: true, subtree: true })
  }
}

browserAPI.runtime.onMessage.addListener(
  (
    message: BrowserMessage,
    sender: any,
    sendResponse: (response: MessageResponse) => void
  ) => {
    // Create an async wrapper function to handle the message
    ;(async () => {
      try {
        switch (message.action) {
          case "updatePopularActiveUrls":
            setActivePopularUrls(
              message.popularActiveUrls
                .filter((item) => item.isActive)
                .map((item) => item.url)
            )
            await initializeFonts()
            sendResponse({ success: true })
            break

          case "updateCustomUrlStatus":
            setActiveCustomUrls(
              message.data
                .filter((item) => item.isActive)
                .map((item) => item.url)
            )
            await initializeFonts()
            sendResponse({ success: true })
            break

          case "updateFont":
            const shouldApply = await shouldApplyFonts()
            if (shouldApply) {
              updateFont(message.fontName)
              await storage.set("selectedFont", message.fontName)
              sendResponse({ success: true })
            } else {
              sendResponse({
                success: false,
                error: "URL not matched or extension disabled."
              })
            }
            break

          case "setActiveStatus":
            if (message.isActive) {
              await initializeFonts()
            }
            sendResponse({ success: true })
            break

          case "toggle":
            setExtensionEnabled(message.isExtensionEnabled)
            if (message.isExtensionEnabled) {
              await initialize()
            } else {
              resetFontToDefault()
              observer.disconnect()
            }
            sendResponse({ success: true })
            break

          case "refreshFonts":
            await initializeFonts()
            sendResponse({ success: true })
            break
        }
      } catch (error) {
        sendResponse({ success: false, error: String(error) })
      }
    })()
    return true // Keep the message channel open
  }
)

const observer = new MutationObserver(async (mutations: MutationRecord[]) => {
  const shouldApply = await shouldApplyFonts()

  if (!shouldApply) {
    return
  }

  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          getAllElementsWithFontFamily(node)
        }
      })
    } else if (
      mutation.type === "attributes" &&
      mutation.target instanceof HTMLElement &&
      mutation.attributeName === "style"
    ) {
      getAllElementsWithFontFamily(mutation.target)
    }
  })
})
