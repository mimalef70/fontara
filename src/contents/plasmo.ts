import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

// Font imports
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

// TypeScript interfaces
interface FontRecord {
  [key: string]: string
}

interface UrlItem {
  id?: string
  src?: string
  isActive: boolean
  url: string
}

interface MessageResponse {
  success: boolean
  error?: string
}

interface FontUpdateMessage {
  action: "updateFont"
  fontName: string
}

interface PopularUrlsMessage {
  action: "updatePopularActiveUrls"
  popularActiveUrls: UrlItem[]
}

interface CustomUrlsMessage {
  action: "updateCustomUrlStatus"
  data: UrlItem[]
}

interface ActiveStatusMessage {
  action: "setActiveStatus"
  isActive: boolean
}

interface ToogleStatus {
  action: "toggle"
  isExtensionEnabled: boolean
}

interface addCustomFont {
  action: "addCustomFont"
  isExtensionEnabled: boolean
}

interface deleteCustomFont {
  action: "deleteCustomFont"
  isExtensionEnabled: boolean
}

interface RefreshMessage {
  action: "refreshFonts"
}

type BrowserMessage = FontUpdateMessage | PopularUrlsMessage | CustomUrlsMessage | ActiveStatusMessage | ToogleStatus | RefreshMessage

// Initialize storage and configuration
const storage = new Storage()

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Font definitions
const localFonts: FontRecord = {
  Behdad: fontBehdad,
  Dana: fontDana,
  Estedad: fontEstedad,
  Gandom: fontGandom,
  Ganjname: fontGanjname,
  Mikhak: fontMikhak,
  Morraba: fontMorraba,
  Nika: fontNika,
  Parastoo: fontParastoo,
  Sahel: fontSahel,
  Samim: fontSamim,
  Shabnam: fontShabnam,
  Shahab: fontShahab,
  Tanha: fontTanha
}

const googleFonts: FontRecord = {
  Vazirmatn: "https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap"
}

// Browser API setup
declare const chrome: any
declare const browser: any
const browserAPI: typeof chrome = typeof browser !== "undefined" ? browser : chrome

// Global variables
let currentFont = "Estedad"
let activePopularUrls: string[] = []
let activeCustomUrls: string[] = []

// Utility functions
export function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  const regexString = `^${escaped.replace(/\*/g, ".*").replace(/\/$/, "")}(\\/[^\\/]+)?$`
  return new RegExp(regexString, "i")
}

export function isCurrentUrlMatched(patterns: string[]): boolean {
  const currentUrl = window.location.href
  return patterns.some((pattern) => {
    const regex = patternToRegex(pattern)
    return regex.test(currentUrl)
  })
}

// Function to load custom fonts from storage
async function loadCustomFonts(): Promise<void> {
  const customFonts: any[] = await storage.get("customFonts") || []
  customFonts.forEach(font => {
    const style = document.createElement("style")
    style.id = `custom-${font.name}-style`
    style.textContent = `
      @font-face {
        font-family: '${font.name}';
        src: url(${font.data}) format('${font.type}');
        font-weight: ${font.weight};
        font-display: fallback;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;

      }
    `
    document.head.appendChild(style)
  })
}

// Add to your loadFont function
async function loadFont(fontName: string): Promise<void> {
  if (fontName in localFonts) {
    const style = document.createElement("style")
    style.id = `${fontName}-style`
    style.textContent = `
          @font-face {
              font-family: '${fontName}';
              src: url(${localFonts[fontName]}) format('woff2');
              font-weight: 100 1000;
              font-display: fallback;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;

          }
      `
    document.head.appendChild(style)
  } else if (fontName in googleFonts) {
    const link = document.createElement("link")
    link.href = googleFonts[fontName]
    link.rel = "stylesheet"
    document.head.appendChild(link)
  } else {
    // Try to load from chrome.storage.local
    try {
      const result = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.local.get(`font_${fontName}`, resolve)
      })

      const fontData = result[`font_${fontName}`]
      if (fontData) {
        const style = document.createElement("style")
        style.id = `custom-${fontName}-style`
        style.textContent = `
                  @font-face {
                      font-family: '${fontName}';
                      src: url(data:font/${fontData.type};base64,${fontData.data});
                      font-display: fallback;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;

                  }
              `
        document.head.appendChild(style)
      }
    } catch (error) {
      console.error(`Failed to load custom font ${fontName}:`, error)
    }
  }
}

function updateFont(fontName: string): void {
  currentFont = fontName
  loadFont(currentFont)
  applyFontToAllElements(currentFont)
}

function applyFontToAllElements(customFont: string): void {
  if (document.body) {
    getAllElementsWithFontFamily(document.body, customFont)
  }
}

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

  let node = treeWalker.nextNode()
  while (node) {
    if (node instanceof HTMLElement) {
      if (
        (node.textContent && node.textContent.trim() !== "") ||
        node.tagName === "INPUT"
      ) {
        const computedStyle = window.getComputedStyle(node)
        let fontFamily = computedStyle.fontFamily

        const isIcon = iconClasses.some((className) =>
          node instanceof Element
            ? node.classList.contains(className) ||
            node.closest(`.${className}`) !== null
            : false
        )

        const isIconFont =
          fontFamily.toLowerCase().startsWith("fontawesome") ||
          fontFamily.toLowerCase().startsWith("material icons") ||
          fontFamily.toLowerCase().includes("icon")

        if (!isIcon && !isIconFont) {
          const customFonts = [...Object.keys(localFonts), ...Object.keys(googleFonts)]
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

// Enhance resetFontToDefault function
export function resetFontToDefault(): void {
  // Remove custom font styles from all elements
  const elements = document.querySelectorAll('*')
  elements.forEach((element) => {
    if (element instanceof HTMLElement) {
      const computedStyle = window.getComputedStyle(element)
      if (computedStyle.fontFamily.includes(currentFont)) {
        element.style.removeProperty('font-family')
      }
    }
  })

  // Remove any custom font style tags
  document.querySelectorAll('style[id$="-style"]').forEach(styleTag => {
    styleTag.remove()
  })
}

export async function initializeFonts(): Promise<void> {
  if (document.body) {
    const isPopularMatch = isCurrentUrlMatched(activePopularUrls)
    const isCustomMatch = isCurrentUrlMatched(activeCustomUrls)

    if (isPopularMatch || isCustomMatch) {
      const storedFont = await storage.get<string>("selectedFont")
      currentFont = storedFont || "Estedad"
      loadFont(currentFont)
      applyFontToAllElements(currentFont)
    } else {
      console.log("Current URL does not match any active patterns. Removing custom fonts.")
      resetFontToDefault()
    }
  }
}

// URL management functions
function updatePopularUrls(newActiveUrls: UrlItem[]): void {
  activePopularUrls = newActiveUrls
    .filter(item => item.isActive)
    .map(item => item.url)
  initializeFonts()
}

function updateCustomUrls(newActiveUrls: UrlItem[]): void {
  activeCustomUrls = newActiveUrls
    .filter(item => item.isActive)
    .map(item => item.url)
  initializeFonts()
}

// Message handling
browserAPI.runtime.onMessage.addListener(
  (message: BrowserMessage, sender: any, sendResponse: (response: MessageResponse) => void) => {
    switch (message.action) {
      case "updatePopularActiveUrls":
        updatePopularUrls(message.popularActiveUrls)
        sendResponse({ success: true })
        break

      case "updateCustomUrlStatus":
        updateCustomUrls(message.data)
        sendResponse({ success: true })
        break

      case "updateFont":
        if (isCurrentUrlMatched(activePopularUrls) || isCurrentUrlMatched(activeCustomUrls)) {
          updateFont(message.fontName)
          storage
            .set("selectedFont", message.fontName)
            .then(() => sendResponse({ success: true }))
            .catch((error) => {
              console.error("Failed to save selected font to storage:", error)
              sendResponse({ success: false, error: String(error) })
            })
        } else {
          console.warn("Current URL does not match any active patterns. Font not applied.")
          sendResponse({ success: false, error: "URL not matched." })
        }
        break

      case "setActiveStatus":

        if (message.isActive) {
          initializeFonts()
        }
        sendResponse({ success: true })
        break

      case "toggle":
        isExtensionEnabled = message.isExtensionEnabled
        if (isExtensionEnabled) {
          initialize()
        } else {
          resetFontToDefault()
          observer.disconnect() // Stop observing when disabled
        }
        sendResponse({ success: true })
        break

      case "refreshFonts":
        initializeFonts()  // Re-initialize fonts when refresh message received
        sendResponse({ success: true })
        break

    }
    return true
  }
)

// Initialization
let isExtensionEnabled = true


async function initialize(): Promise<void> {
  // Get extension state first
  const storedEnabled = await storage.get<boolean>("isExtensionEnabled")
  isExtensionEnabled = storedEnabled ?? true

  if (!isExtensionEnabled) {
    resetFontToDefault()
    return
  }

  // Only proceed if document.body exists
  if (document.body) {
    // Load custom fonts
    await loadCustomFonts()

    // Get stored URLs
    const storedPopularUrls = await storage.get<UrlItem[]>("popularActiveUrls")
    const storedCustomUrls = await storage.get<UrlItem[]>("customActiveUrls")

    // Update URL arrays
    if (storedPopularUrls) {
      updatePopularUrls(storedPopularUrls)
    }
    if (storedCustomUrls) {
      updateCustomUrls(storedCustomUrls)
    }

    // Check if current URL matches any patterns
    const isPopularMatch = isCurrentUrlMatched(activePopularUrls)
    const isCustomMatch = isCurrentUrlMatched(activeCustomUrls)

    if ((isPopularMatch || isCustomMatch) && isExtensionEnabled) {
      const storedFont = await storage.get<string>("selectedFont")
      currentFont = storedFont || "Estedad"
      await loadFont(currentFont)
      applyFontToAllElements(currentFont)
    } else {
      resetFontToDefault()
    }

    // Set up observer only if extension is enabled
    if (isExtensionEnabled) {
      observer.observe(document.body, { childList: true, subtree: true })
    }
  }
}

initialize()

// MutationObserver setup
const observer = new MutationObserver((mutations: MutationRecord[]) => {
  if (!isExtensionEnabled) return

  const isPopularMatch = isCurrentUrlMatched(activePopularUrls)
  const isCustomMatch = isCurrentUrlMatched(activeCustomUrls)

  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if ((isPopularMatch || isCustomMatch) && isExtensionEnabled) {
            getAllElementsWithFontFamily(node, currentFont)
          }
        }
      })
    }
  })
})

observer.observe(document.body, { childList: true, subtree: true })