// Import fonts as base64
import fontBehdad from "data-base64:../../assets/fonts/behdad/variable/Behdad-Regular.woff"
import fontDana from "data-base64:../../assets/fonts/dana/variable/Dana-Regular.woff2"
import fontEstedad from "data-base64:../../assets/fonts/estedad/variable/Estedad[KSHD,wght].woff2"
import fontGandom from "data-base64:../../assets/fonts/gandom/variable/Gandom-WOL.woff"
import fontGanjname from "data-base64:../../assets/fonts/ganjname/variable/GanjNamehSans-Regular.woff2"
import fontMikhak from "data-base64:../../assets/fonts/mikhak/variable/Mikhak-Regular.woff2"
import fontMorraba from "data-base64:../../assets/fonts/morraba/variable/MorabbaVF.woff2"
import fontNika from "data-base64:../../assets/fonts/nika/variable/Nika-Regular.woff2"
import fontParastoo from "data-base64:../../assets/fonts/parastoo/variable/Parastoo-WOL.woff"
import fontSahel from "data-base64:../../assets/fonts/sahel/variable/Sahel-WOL.woff"
import fontSamim from "data-base64:../../assets/fonts/samim/variable/Samim-WOL.woff"
import fontShabnam from "data-base64:../../assets/fonts/shabnam/variable/Shabnam-WOL.woff"
import fontShahab from "data-base64:../../assets/fonts/shahab/variable/Shahab-Regular.woff2"
import fontTanha from "data-base64:../../assets/fonts/tanha/variable/Tanha-WOL.woff"
import type { PlasmoCSConfig } from "plasmo"

import { Storage } from "@plasmohq/storage"

const storage = new Storage()

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Define local and Google fonts
const localFonts: Record<string, string> = {
  Estedad: fontEstedad,
  Morraba: fontMorraba,
  Dana: fontDana,
  Samim: fontSamim,
  Shabnam: fontShabnam,
  Sahel: fontSahel,
  Parastoo: fontParastoo,
  Gandom: fontGandom,
  Tanha: fontTanha,
  Behdad: fontBehdad,
  Nika: fontNika,
  Ganjname: fontGanjname,
  Shahab: fontShahab,
  Mikhak: fontMikhak
}

const googleFonts: Record<string, string> = {
  Vazirmatn: "https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap"
}

let currentFont = "Estedad"
let activeUrls: string[] = []

// Function to convert wildcard patterns to RegExp
export function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  const regexString = `^${escaped.replace(/\*/g, ".*")}$`
  return new RegExp(regexString, "i") // Case-insensitive matching
}

// Function to check if current URL matches any pattern
export function isCurrentUrlMatched(patterns: string[]): boolean {
  const currentUrl = window.location.href
  return patterns.some((pattern) => {
    const regex = patternToRegex(pattern)
    return regex.test(currentUrl)
  })
}

// Function to update the current font
function updateFont(fontName: string) {
  currentFont = fontName
  loadFont(currentFont)
  applyFontToAllElements(currentFont)
}

// Function to load the selected font
function loadFont(fontName: string) {
  if (fontName in localFonts) {
    const style = document.createElement("style")
    style.id = `${fontName}-style`
    style.textContent = `
      @font-face {
        font-family: '${fontName}';
        src: url(${localFonts[fontName]}) format('woff2');
        font-weight: 100 1000;
        font-display: fallback;
      }
    `
    document.head.appendChild(style)
  } else if (fontName in googleFonts) {
    const link = document.createElement("link")
    link.href = googleFonts[fontName]
    link.rel = "stylesheet"
    document.head.appendChild(link)
  } else {
    console.warn(`Font ${fontName} not found in local or Google fonts`)
  }
}

// Function to apply the font to all elements
function applyFontToAllElements(customFont: string) {
  getAllElementsWithFontFamily(document.body, customFont)
}

// Function to traverse and apply the font to elements
function getAllElementsWithFontFamily(
  rootNode: HTMLElement,
  customFont: string
): void {
  const treeWalker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT
  )

  const iconClasses = [
    "fa",
    "fas",
    "far",
    "fal",
    "fad",
    "fab",
    "material-icons",
    "material-icons-outlined",
    "material-icons-round",
    "material-icons-sharp",
    "glyphicon",
    "icon"
  ]

  let node: Node | null = treeWalker.nextNode()
  while (node) {
    if (node instanceof HTMLElement) {
      if (
        (node.textContent && node.textContent.trim() !== "") ||
        node.tagName === "INPUT"
      ) {
        const computedStyle = window.getComputedStyle(node)
        let fontFamily = computedStyle.fontFamily

        const isIcon = iconClasses.some((className) => {
          if (node instanceof Element) {
            return (
              node.classList.contains(className) ||
              node.closest(`.${className}`) !== null
            )
          }
          return false
        })

        const isIconFont =
          fontFamily.toLowerCase().startsWith("fontawesome") ||
          fontFamily.toLowerCase().startsWith("material icons") ||
          fontFamily.toLowerCase().includes("icon") ||
          false

        if (!isIcon && !isIconFont) {
          const customFonts = Object.keys(localFonts).concat(
            Object.keys(googleFonts)
          )
          customFonts.forEach((font) => {
            fontFamily = fontFamily.replace(
              new RegExp(`${font},?\\s*`, "i"),
              ""
            )
          })

          node.style.fontFamily = `${customFont}, ${fontFamily.trim()}`
        }
      }
    }

    node = treeWalker.nextNode()
  }
}

// Function to remove the applied font and reset to default font
function resetFontToDefault() {
  const customFontElements = document.querySelectorAll("[style*='font-family']")
  customFontElements.forEach((element: HTMLElement) => {
    const computedStyle = window.getComputedStyle(element)
    // Only reset if the custom font was applied
    if (computedStyle.fontFamily.includes(currentFont)) {
      element.style.fontFamily = "" // Reset the font-family to default
    }
  })

  // Remove the injected style tag for the custom font
  const styleTag = document.getElementById(`${currentFont}-style`)
  if (styleTag) {
    styleTag.remove()
  }
}

// Modify the initializeFonts function to reset fonts if URL is not active
async function initializeFonts() {
  if (document.body) {
    if (isCurrentUrlMatched(activeUrls)) {
      const storedFont = await storage.get("selectedFont")
      currentFont = storedFont || "Estedad"
      loadFont(currentFont)
      applyFontToAllElements(currentFont)
    } else {
      console.log(
        "Current URL does not match any active patterns. Removing custom fonts."
      )
      resetFontToDefault() // Reset the fonts when URL is not active
    }
  }
}

// Function to update active URLs
async function updateActiveUrls() {
  const list: { isActive: boolean; url: string }[] =
    (await storage.get("activeUrls")) || []
  activeUrls = list.filter((item) => item.isActive).map((item) => item.url)

  // Re-run initialization with new active URLs
  initializeFonts()
}

// Listen for the custom event
window.addEventListener("activeUrlsChanged", (event: CustomEvent) => {
  updateActiveUrls()
})

// Listen for messages to update the font or active URLs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateActiveUrls") {
    updateActiveUrlsAndInitialize(message.activeUrls)
    sendResponse({ success: true })
  } else if (message.action === "updateFont") {
    if (isCurrentUrlMatched(activeUrls)) {
      updateFont(message.fontName)
      storage
        .set("selectedFont", message.fontName)
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error("Failed to save selected font to storage:", error)
          sendResponse({ success: false, error: String(error) })
        })
    } else {
      console.warn(
        "Current URL does not match any active patterns. Font not applied."
      )
      sendResponse({ success: false, error: "URL not matched." })
    }
  } else if (message.action === "setActiveStatus") {
    if (message.isActive) {
      initializeFonts()
    }
  }
  return true // Indicates that the response is sent asynchronously
})

// Function to update active URLs and reset fonts if necessary
function updateActiveUrlsAndInitialize(newActiveUrls) {
  activeUrls = newActiveUrls
    .filter((item) => item.isActive)
    .map((item) => item.url)
  initializeFonts() // Re-run initialization after updating active URLs
}

// Initialize fonts on page load
storage.get("activeUrls").then((storedActiveUrls) => {
  if (storedActiveUrls) {
    updateActiveUrlsAndInitialize(storedActiveUrls)
  }
})

// Optional: Re-apply fonts on dynamic content changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (isCurrentUrlMatched(activeUrls)) {
            getAllElementsWithFontFamily(node, currentFont)
          }
        }
      })
    }
  })
})

observer.observe(document.body, { childList: true, subtree: true })
