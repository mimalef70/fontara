import { Storage } from "@plasmohq/storage"

import { rootStyle } from "~src/contents/plasmo"
import { excludedTags, iconClasses } from "~src/utils/constants"
import type { UrlItem } from "~src/utils/types"
import { isCurrentUrlMatched } from "~src/utils/utils"

import {
  getState,
  initializeState,
  setActiveCustomUrls,
  setActivePopularUrls,
  setCurrentFont,
  setExtensionEnabled
} from "../store/fontStore"
import { localFonts } from "../utils/fonts"

const storage = new Storage()

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

export async function handleInitialSetup(): Promise<void> {
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

export function applyFontToAllElements(): void {
  if (document.body) {
    const state = getState()

    const computedBodyStyle = window.getComputedStyle(document.body)
    let bodyFontFamily = computedBodyStyle.fontFamily

    // Clean up any previous instances of our fonts AND the current font
    const customFonts = [
      ...Object.keys(localFonts)
      // ...Object.keys(googleFonts)
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
        ...Object.keys(localFonts)
        // ...Object.keys(googleFonts)
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

export function updateFont(fontName: string): void {
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

export async function initializeFonts(): Promise<void> {
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

export async function initialize(): Promise<void> {
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
}

export function updateRootVariable(fontName: string): void {
  rootStyle.textContent = `
      :root {
        --fontara-font: "${fontName}";
      }
    `
}

export async function loadFont(fontName: string): Promise<void> {
  if (fontName in localFonts) {
    const style = document.createElement("style")
    style.id = `${fontName}-style`
    style.textContent = `
          @font-face {
            font-family: "${fontName}";
            src: url(${localFonts[fontName]}) format('woff2');
            font-weight: 100 1000;
            font-display: fallback;
          }
        `
    document.head.appendChild(style)
  } else {
    try {
      const result = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.local.get(`font_${fontName}`, resolve)
      })
      //  else if (fontName in googleFonts) {
      //   const link = document.createElement("link")
      //   link.href = googleFonts[fontName]
      //   link.rel = "stylesheet"
      //   document.head.appendChild(link)
      // }

      const fontData = result[`font_${fontName}`]
      if (fontData) {
        const style = document.createElement("style")
        style.id = `custom-${fontName}-style`
        style.textContent = `
              @font-face {
                font-family: "${fontName}";
                src: url(data:font/${fontData.type};base64,${fontData.data});
                font-display: fallback;
              }
            `
        document.head.appendChild(style)
      }
    } catch (error) {
      // Handle error
    }
  }
}

export { setActivePopularUrls, setActiveCustomUrls, setExtensionEnabled }
