import styleText from "data-text:../fonts.css"
import type { PlasmoCSConfig } from "plasmo"

import { Storage } from "@plasmohq/storage"

import { CUSTOM_CSS, excludedTags, iconClasses } from "~src/lib/constants"
import { isUrlActive } from "~src/lib/utils"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const storage = new Storage({
  area: "local"
})
const storageLocal = new Storage({
  area: "local"
})

let observer: MutationObserver | null = null

async function injectFontStyles() {
  const currentUrl = window.location.href
  const websiteList = await storage.get("websiteList")
  const matchingWebsite = (websiteList as any).find((website) => {
    const regex = new RegExp(website.regex, "i")
    return regex.test(currentUrl.trim())
  })

  try {
    // Check if styles are already injected
    const existingStyles = document.getElementById("fontara-font-styles")
    if (existingStyles) return

    // Create style element for built-in fonts
    const style = document.createElement("style")
    style.id = "fontara-font-styles"
    style.textContent = styleText
    document.head.appendChild(style)

    // const styleElement = document.createElement("style")
    // // Set type and content
    // styleElement.id = "fontara-font-test-styles"
    // styleElement.textContent = `
    //   [data-fontara-processed] {
    //     font-family: '';
    //   }
    // `
    // // Append to head
    // document.head.appendChild(styleElement)

    if (matchingWebsite?.customCss) {
      // Check if this custom CSS style is already injected
      const existingCustomCssStyle = document.getElementById(
        "fontara-custom-css-style"
      )
      if (!existingCustomCssStyle) {
        const style = document.createElement("style")
        style.id = "fontara-custom-css-style"
        style.textContent = CUSTOM_CSS[matchingWebsite.url]
        document.head.appendChild(style)
      }
    }

    // Create a separate style element for custom fonts
    const customStyle = document.createElement("style")
    customStyle.id = "fontara-custom-font-styles"

    const customFontList = await storageLocal.get("customFontList")

    if (
      customFontList &&
      Array.isArray(customFontList) &&
      customFontList.length > 0
    ) {
      let customFontFaces = ""
      customFontList.forEach((font) => {
        if (font.value && font.data) {
          const fontName = font.value
          const fontData = font.data

          // Create the font-face declaration. Determine format based on data
          // This assumes the data is base64 encoded font data
          let format = "truetype" // Default format

          if (fontData.includes("data:font/woff2")) {
            format = "woff2"
          } else if (fontData.includes("data:font/woff")) {
            format = "woff"
          } else if (fontData.includes("data:font/otf")) {
            format = "opentype"
          } else if (fontData.includes("data:font/ttf")) {
            format = "truetype"
          }

          customFontFaces += `
            @font-face {
              font-family: "${fontName}";
              src: url("${fontData}") format("${format}");
              font-weight: normal;
              font-style: normal;
              font-display: swap;
            }
          `
        }
      })

      // Set the style content with all the custom font faces
      customStyle.textContent = customFontFaces
      document.head.appendChild(customStyle)
    }
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
    }

    // Remove the dynamic font variable
    const dynamicFont = document.getElementById("fontara-dynamic-font")
    if (dynamicFont) {
      dynamicFont.remove()
    }

    // Remove the dynamic font variable
    const customFont = document.getElementById("fontara-custom-font-styles")
    if (customFont) {
      customFont.remove()
    }

    // Remove the dynamic css variable
    const customCss = document.getElementById("fontara-custom-css-style")
    if (customCss) {
      customCss.remove()
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
  // node.style.fontFamily = `var(--fontara-font), ${cleanFontFamily} !important`
  // node.style.fontFamily = `var(--fontara-font), ${cleanFontFamily}`
  node.setAttribute(
    "style",
    `font-family: var(--fontara-font)${cleanFontFamily ? `, ${cleanFontFamily}` : ""} !important; ${node.getAttribute("style") || ""}`
  )
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
    injectFontStyles()
    await initializeFontVariable()

    if (document.body) {
      await getAllElementsWithFontFamily(document.body)
      startObserving()
    }
  } else {
    // Site is not active, remove fonts
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
  }
}

function stopObserving() {
  if (observer) {
    observer.disconnect()
    observer = null
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
    applyFontsIfActive()
  },
  websiteList: async (change) => {
    applyFontsIfActive()
  }
  // customFontList: async (change) => {
  //   console.log("customFontList changed:", change.newValue)
  // }
})
