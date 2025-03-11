import styleText from "data-text:../fonts.css"
import type { PlasmoCSConfig } from "plasmo"

import { Storage } from "@plasmohq/storage"

import { isUrlActive } from "~src/lib/utils"
import { excludedTags, iconClasses } from "~src/utils/constants"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const storage = new Storage()
let observer: MutationObserver | null = null

function injectFontStyles() {
  try {
    // Check if styles are already injected
    const existingStyles = document.getElementById("fontara-font-styles")
    if (existingStyles) return

    const style = document.createElement("style")
    style.id = "fontara-font-styles"
    style.textContent = styleText
    document.head.appendChild(style)
    console.log("Font styles injected successfully")
  } catch (err) {
    console.error("Failed to inject font styles:", err)
  }
}

function removeFontStyles() {
  try {
    // Remove the font styles
    const fontStyles = document.getElementById("fontara-font-styles")
    if (fontStyles) {
      fontStyles.remove()
      console.log("Font styles removed successfully")
    }

    // Remove the dynamic font variable
    const dynamicFont = document.getElementById("fontara-dynamic-font")
    if (dynamicFont) {
      dynamicFont.remove()
      console.log("Dynamic font variable removed successfully")
    }

    // Remove the applied styles from all elements
    const allElements = document.querySelectorAll("[style*='fontara-font']")
    allElements.forEach((element) => {
      if (element instanceof HTMLElement) {
        // Simply remove the inline style to revert to original style
        element.style.fontFamily = ""
        if (element.style.length === 0) {
          element.removeAttribute("style")
        }
      }
    })

    console.log("Removed fontara styles from all elements")
  } catch (err) {
    console.error("Failed to remove font styles:", err)
  }
}

function processElement(node: HTMLElement): void {
  // node.setAttribute("data-fontara-processed", "true")

  if (excludedTags.includes(node.tagName.toLowerCase())) {
    return
  }

  // Check if the node has visible text content (excluding child elements)
  // const hasText = Array.from(node.childNodes).some(
  //   (child) =>
  //     child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0
  // )

  // // If node doesn't have text content, don't change its font
  // if (!hasText) {
  //   return
  // }

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

  if (isIcon || isIconFont) {
    return
  }

  // Parse the font family correctly, handling quotes properly
  const fontFamilies = fontFamily
    .split(",")
    .map((f) => f.trim().replace(/^["']+|["']+$/g, "")) // Remove quotes
    .filter((f) => !f.includes("-Fontara") && Boolean(f)) // Remove fontara fonts and empty entries

  const cleanFontFamily = fontFamilies.join(", ")

  // Apply the new font-family without duplicating
  node.style.fontFamily = `var(--fontara-font), ${cleanFontFamily} !important`
}

export async function getAllElementsWithFontFamily(
  rootNode: HTMLElement
): Promise<void> {
  if (!rootNode) return

  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT)
  let node = walker.nextNode()
  while (node) {
    if (node instanceof HTMLElement) {
      processElement(node as HTMLElement)
    }
    node = walker.nextNode()
  }
}

async function applyFontsIfActive() {
  const currentUrl = window.location.href
  const isActive = await isUrlActive(currentUrl)

  if (isActive) {
    // Site is active, apply fonts
    console.log("Site is active, applying fonts")
    injectFontStyles()
    await initializeFontVariable()

    if (document.body) {
      await getAllElementsWithFontFamily(document.body)
      startObserving()
    }
  } else {
    // Site is not active, remove fonts
    console.log("Site is not active, removing fonts")
    stopObserving()
    removeFontStyles()
  }
}

function startObserving() {
  if (observer) {
    // If already observing, disconnect first to avoid multiple observers
    stopObserving()
  }

  observer = new MutationObserver(async (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            getAllElementsWithFontFamily(node)
          }
        }
      }
      // else if (
      //   mutation.type === "characterData" &&
      //   mutation.target.parentElement instanceof HTMLElement
      // ) {
      //   getAllElementsWithFontFamily(mutation.target.parentElement)
      // }
      // else if (mutation.target instanceof HTMLElement) {
      //   // For input/textarea values and other element changes
      //   getAllElementsWithFontFamily(mutation.target)
      // }
    }
  })

  if (document.body) {
    observer.observe(document.body, {
      subtree: true,
      childList: true
    })
    console.log("Started observing DOM mutations")
  }
}

function stopObserving() {
  if (observer) {
    observer.disconnect()
    observer = null
    console.log("Stopped observing DOM mutations")
  }
}

function updateFontVariable(fontName: string) {
  if (!fontName) return

  // Check if the style element already exists
  let styleElement = document.getElementById("fontara-dynamic-font")

  // If not, create it
  if (!styleElement) {
    styleElement = document.createElement("style")
    styleElement.id = "fontara-dynamic-font"
    document.head.appendChild(styleElement)
  }

  // Update the CSS variable definition
  styleElement.textContent = `
    :root {
      --fontara-font: "${fontName}";
    }
  `

  console.log(`Font updated to: ${fontName}`)
}

async function initializeFontVariable() {
  const selectedFont = await storage.get("selectedFont")
  if (selectedFont) {
    updateFontVariable(selectedFont)
  }
}

// Initial setup when content script loads
if (document.body) {
  applyFontsIfActive()
}

// Watch for storage changes
storage.watch({
  selectedFont: (change) => {
    updateFontVariable(change.newValue)
  },
  isExtensionEnabled: async (change) => {
    console.log("isExtensionEnabled changed:", change.newValue)
    applyFontsIfActive()
  },
  websiteList: async (change) => {
    console.log("websiteList changed:", change.newValue)
    applyFontsIfActive()
  }
})
