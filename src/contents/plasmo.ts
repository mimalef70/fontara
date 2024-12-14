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
let isExtensionEnabled = true

// Create and append root style element
const rootStyle = document.createElement('style')
rootStyle.id = 'fontara-root-styles'
document.head.appendChild(rootStyle)

// Function to update CSS variable
function updateRootVariable(fontName: string | { value: string } | null): void {
  if (!fontName) {
    return;
  }

  const fontValue = typeof fontName === 'object' ? fontName.value : fontName
  rootStyle.textContent = `
    :root {
      --fontara-font: "${fontValue}";
    }
  `}

async function handleInitialSetup(): Promise<void> {
  try {
    // Set default active URLs
    activePopularUrls = ["*://*/*"];
    activeCustomUrls = [];

    // Get or set the initial font
    const storedFont = await storage.get("selectedFont");
    if (!storedFont) {
      await storage.set("selectedFont", "Estedad");
    }

    // Get or set popularActiveUrls with default state
    const storedPopularUrls = await storage.get<UrlItem[]>("popularActiveUrls");
    if (!storedPopularUrls) {
      const defaultPopularUrls: UrlItem[] = [{
        url: "*://*/*",
        isActive: true
      }];
      await storage.set("popularActiveUrls", defaultPopularUrls);
      updatePopularUrls(defaultPopularUrls);
    } else {
      updatePopularUrls(storedPopularUrls);
    }

    // Verify our values were set
    const verifyFont = await storage.get("selectedFont");
    const verifyUrls = await storage.get("popularActiveUrls");

    if (!verifyFont || !verifyUrls) {
      throw new Error("Failed to set initial values");
    }

    // Apply fonts immediately if we're on a matching URL
    if (isCurrentUrlMatched(activePopularUrls) || isCurrentUrlMatched(activeCustomUrls)) {
      await initializeFonts();
    }
  } catch (error) {
    console.error("Error in initial setup:", error);
  }
}

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

async function loadCustomFonts(): Promise<void> {
  const customFonts: any[] = await storage.get("customFonts") || []
  customFonts.forEach(font => {
    const style = document.createElement("style")
    style.id = `custom-${font.name}-style`
    style.textContent = `
      @font-face {
        font-family: "${font.name}";
        src: url(${font.data}) format('${font.type}');
        font-weight: ${font.weight};
        font-display: fallback;
      }
    `
    document.head.appendChild(style)
  })
}

async function loadFont(fontName: string | { value: string } | null): Promise<void> {
  if (!fontName) {
    return;
  }

  // Ensure fontName is a string
  const fontValue = typeof fontName === 'object' ? fontName.value : fontName

  if (fontValue in localFonts) {
    const style = document.createElement("style")
    style.id = `${fontValue}-style`
    style.textContent = `
      @font-face {
        font-family: "${fontValue}";
        src: url(${localFonts[fontValue]}) format('woff2');
        font-weight: 100 1000;
        font-display: fallback;
      }
    `
    document.head.appendChild(style)
  } else if (fontValue in googleFonts) {
    const link = document.createElement("link")
    link.href = googleFonts[fontValue]
    link.rel = "stylesheet"
    document.head.appendChild(link)
  }
}


function applyFontToAllElements(): void {
  if (document.body) {
    // Apply font to body tag first
    const computedBodyStyle = window.getComputedStyle(document.body)
    let bodyFontFamily = computedBodyStyle.fontFamily

    const customFonts = [...Object.keys(localFonts), ...Object.keys(googleFonts)]
    customFonts.forEach((font) => {
      bodyFontFamily = bodyFontFamily.replace(
        new RegExp(`${font},?\\s*`, "i"),
        ""
      )
    })

    document.body.style.fontFamily = `var(--fontara-font), ${bodyFontFamily.trim()}`

    // Then proceed with existing functionality for all other elements
    getAllElementsWithFontFamily(document.body)
  }
}

function updateFont(fontName: string): void {
  currentFont = fontName
  loadFont(currentFont).then(() => {
    updateRootVariable(currentFont)
    applyFontToAllElements()
  })
}

function getAllElementsWithFontFamily(rootNode: HTMLElement): void {
  const treeWalker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT
  )

  const iconClasses = [
    "fa", "fas", "far", "fal", "fad", "fab",
    "material-icons", "material-icons-outlined",
    "material-icons-round", "material-icons-sharp",
    "glyphicon", "icon"
  ]

  let node = treeWalker.nextNode()
  while (node) {
    if (node instanceof HTMLElement) {
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

        node.style.fontFamily = `var(--fontara-font), ${fontFamily.trim()}`
      }
    }
    node = treeWalker.nextNode()
  }
}

export function resetFontToDefault(): void {
  if (document.body) {
    // Remove the CSS variable
    rootStyle.textContent = ''

    // Reset body font family
    document.body.style.removeProperty('font-family')

    // Reset all elements
    const elements = document.querySelectorAll('*')
    elements.forEach((element) => {
      if (element instanceof HTMLElement) {
        if (element.style.fontFamily) {
          element.style.removeProperty('font-family')
        }
      }
    })

    // Remove any custom font style tags
    document.querySelectorAll('style[id$="-style"]').forEach(styleTag => {
      styleTag.remove()
    })
  }
}

export async function initializeFonts(): Promise<void> {
  if (document.body) {
    const isPopularMatch = isCurrentUrlMatched(activePopularUrls)
    const isCustomMatch = isCurrentUrlMatched(activeCustomUrls)

    if (isPopularMatch || isCustomMatch) {
      const storedFont = await storage.get<string>("selectedFont")
      currentFont = storedFont || "Estedad"
      await loadFont(currentFont)
      updateRootVariable(currentFont)
      applyFontToAllElements()
    } else {
      resetFontToDefault()
    }
  }
}

const observer = new MutationObserver((mutations: MutationRecord[]) => {
  if (!isExtensionEnabled) return

  const isPopularMatch = isCurrentUrlMatched(activePopularUrls)
  const isCustomMatch = isCurrentUrlMatched(activeCustomUrls)

  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if ((isPopularMatch || isCustomMatch) && isExtensionEnabled) {
            getAllElementsWithFontFamily(node)
          }
        }
      })
    }
  })
})

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
              sendResponse({ success: false, error: String(error) })
            })
        } else {
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
          observer.disconnect()
        }
        sendResponse({ success: true })
        break

      case "refreshFonts":
        initializeFonts()
        sendResponse({ success: true })
        break
    }
    return true
  }
)


async function initialize(): Promise<void> {
  await handleInitialSetup()

  const storedEnabled = await storage.get<boolean>("isExtensionEnabled")
  isExtensionEnabled = storedEnabled ?? true

  if (document.body) {
    await loadCustomFonts()
    await loadFont("Estedad")

    const storedPopularUrls = await storage.get<UrlItem[]>("popularActiveUrls")
    const storedCustomUrls = await storage.get<UrlItem[]>("customActiveUrls")

    if (storedPopularUrls) {
      updatePopularUrls(storedPopularUrls)
    }
    if (storedCustomUrls) {
      updateCustomUrls(storedCustomUrls)
    }

    const isPopularMatch = isCurrentUrlMatched(activePopularUrls)
    const isCustomMatch = isCurrentUrlMatched(activeCustomUrls)

    if ((isPopularMatch || isCustomMatch) && isExtensionEnabled) {
      const storedFont = await storage.get<string | { value: string }>("selectedFont")

      // Handle potential object in stored font
      currentFont = typeof storedFont === 'object' ? storedFont.value : (storedFont || "Estedad")
      await loadFont(currentFont)
      updateRootVariable(currentFont)
      applyFontToAllElements()
    } else {
      resetFontToDefault()
    }

    if (isExtensionEnabled) {
      observer.observe(document.body, { childList: true, subtree: true })
    }
  }
}

// Call initialize immediately when the script loads
initialize();

observer.observe(document.body, { childList: true, subtree: true })