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

async function shouldApplyFonts(): Promise<boolean> {
  if (!isExtensionEnabled) {
    return false
  }

  const storedPopularUrls = await storage.get<UrlItem[]>("popularActiveUrls")
  const storedCustomUrls = await storage.get<UrlItem[]>("customActiveUrls")

  // Update active URLs arrays with latest data
  activePopularUrls = storedPopularUrls
    ? storedPopularUrls.filter(item => item.isActive).map(item => item.url)
    : ["*://*/*"]

  activeCustomUrls = storedCustomUrls
    ? storedCustomUrls.filter(item => item.isActive).map(item => item.url)
    : []

  return isCurrentUrlMatched(activePopularUrls) || isCurrentUrlMatched(activeCustomUrls)
}


// Function to update CSS variable
function updateRootVariable(fontName: string): void {
  rootStyle.textContent = `
    :root {
      --fontara-font: "${fontName}";
    }
  `}

async function handleInitialSetup(): Promise<void> {
  try {
    // Update active URLs arrays
    activePopularUrls = ["*://*/*"]
    activeCustomUrls = []

    // Double check our values were set
    const verifyFont = await storage.get("selectedFont")
    const verifyUrls = await storage.get("popularActiveUrls")

    if (!verifyFont || !verifyUrls) {
      throw new Error("Failed to set initial values")
    }
  } catch (error) {
    // console.error("Error in initial setup:", error)
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

async function loadFont(fontName: string): Promise<void> {
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
  } else if (fontName in googleFonts) {
    const link = document.createElement("link")
    link.href = googleFonts[fontName]
    link.rel = "stylesheet"
    document.head.appendChild(link)
  } else {
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

function applyFontToAllElements(): void {
  if (document.body) {
    const computedBodyStyle = window.getComputedStyle(document.body)
    let bodyFontFamily = computedBodyStyle.fontFamily

    // Clean up any previous instances of our fonts AND the current font
    const customFonts = [...Object.keys(localFonts), ...Object.keys(googleFonts)]
    customFonts.forEach((font) => {
      bodyFontFamily = bodyFontFamily.replace(
        new RegExp(`${font},?\\s*`, "i"),
        ""
      )
    })
    // Also remove the current font name if it exists
    bodyFontFamily = bodyFontFamily.replace(
      new RegExp(`${currentFont},?\\s*`, "i"),
      ""
    )

    // Apply to body with CSS variable first, then original fonts as fallback
    document.body.style.setProperty(
      'font-family',
      `var(--fontara-font), ${bodyFontFamily.trim()}`
    );

    // Process all elements
    getAllElementsWithFontFamily(document.body);
  }
}



function getAllElementsWithFontFamily(rootNode: HTMLElement): void {
  const excludedTags = [
    'script', 'style', 'img', 'svg', 'path', 'circle', 'rect',
    'polygon', 'canvas', 'video', 'audio'
  ];

  const iconClasses = [
    'fa', 'fas', 'far', 'fal', 'fad', 'fab',
    'material-icons', 'material-icons-outlined',
    'material-icons-round', 'material-icons-sharp',
    'glyphicon', 'icon', 'iconfont', 'mui-icon',
    'dashicons', 'wp-menu-image'
  ];

  const processNode = (node: HTMLElement) => {
    if (excludedTags.includes(node.tagName.toLowerCase())) {
      return;
    }

    const isIcon = iconClasses.some(className =>
      node.classList.contains(className) ||
      node.closest(`.${className}`) !== null
    );

    const computedStyle = window.getComputedStyle(node)
    let fontFamily = computedStyle.fontFamily

    const isIconFont =
      fontFamily.toLowerCase().includes('fontawesome') ||
      fontFamily.toLowerCase().includes('material') ||
      fontFamily.toLowerCase().includes('icon') ||
      fontFamily.toLowerCase().includes('glyphicon');

    if (!isIcon && !isIconFont) {
      // Clean up any previous instances of our fonts AND the current font
      const customFonts = [...Object.keys(localFonts), ...Object.keys(googleFonts)]
      customFonts.forEach((font) => {
        fontFamily = fontFamily.replace(
          new RegExp(`${font},?\\s*`, "i"),
          ""
        )
      })
      // Also remove the current font name if it exists
      fontFamily = fontFamily.replace(
        new RegExp(`${currentFont},?\\s*`, "i"),
        ""
      )

      // Set font-family with CSS variable first, then original fonts as fallback
      node.style.setProperty(
        'font-family',
        `var(--fontara-font), ${fontFamily.trim()}`
      );
    }

    // Handle Shadow DOM
    if (node.shadowRoot) {
      const shadowWalker = document.createTreeWalker(
        node.shadowRoot,
        NodeFilter.SHOW_ELEMENT
      );
      let shadowNode = shadowWalker.nextNode();
      while (shadowNode) {
        if (shadowNode instanceof HTMLElement) {
          processNode(shadowNode);
        }
        shadowNode = shadowWalker.nextNode();
      }
    }

    // Handle iframes
    if (node instanceof HTMLIFrameElement) {
      try {
        const iframeDoc = node.contentDocument || node.contentWindow?.document;
        if (iframeDoc?.body) {
          const iframeWalker = document.createTreeWalker(
            iframeDoc.body,
            NodeFilter.SHOW_ELEMENT
          );
          let iframeNode = iframeWalker.nextNode();
          while (iframeNode) {
            if (iframeNode instanceof HTMLElement) {
              processNode(iframeNode);
            }
            iframeNode = iframeWalker.nextNode();
          }
        }
      } catch (e) {
        // Handle cross-origin iframe errors silently
      }
    }
  };

  if (rootNode) {
    const walker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_ELEMENT
    );
    let node = walker.nextNode();
    while (node) {
      if (node instanceof HTMLElement) {
        processNode(node);
      }
      node = walker.nextNode();
    }
  }
}

function updateFont(fontName: string): void {
  currentFont = fontName
  loadFont(currentFont).then(() => {
    updateRootVariable(currentFont)
    applyFontToAllElements()
  })
}

export function resetFontToDefault(): void {
  if (document.body) {
    // Remove the CSS variable definition
    rootStyle.textContent = '';

    // Reset body font family
    document.body.style.removeProperty('font-family');
    if (document.body.style.length === 0) {
      document.body.removeAttribute('style');
    }

    // Reset all elements
    const elements = document.querySelectorAll('*');
    elements.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.style.removeProperty('font-family');
        if (element.style.length === 0) {
          element.removeAttribute('style');
        }
      }
    });
  }
}

async function initializeFonts(): Promise<void> {
  if (!document.body) return

  const shouldApply = await shouldApplyFonts()

  if (shouldApply) {
    const storedFont = await storage.get<string>("selectedFont")
    currentFont = storedFont || "Estedad"
    await loadFont(currentFont)
    updateRootVariable(currentFont)
    applyFontToAllElements()
  } else {
    resetFontToDefault()
  }
}

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
    } else if (mutation.type === "attributes" &&
      mutation.target instanceof HTMLElement &&
      mutation.attributeName === "style") {
      getAllElementsWithFontFamily(mutation.target)
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

async function initialize(): Promise<void> {
  await handleInitialSetup()

  const shouldApply = await shouldApplyFonts()

  if (shouldApply && document.body) {
    const storedFont = await storage.get<string>("selectedFont")
    currentFont = storedFont || "Estedad"
    await loadFont(currentFont)
    updateRootVariable(currentFont)
    applyFontToAllElements()
  }

  // Only observe if extension is enabled
  if (isExtensionEnabled) {
    observer.observe(document.body, { childList: true, subtree: true })
  }
}

browserAPI.runtime.onMessage.addListener(
  async (message: BrowserMessage, sender: any, sendResponse: (response: MessageResponse) => void) => {
    switch (message.action) {
      case "updatePopularActiveUrls":
        activePopularUrls = message.popularActiveUrls
          .filter(item => item.isActive)
          .map(item => item.url)
        await initializeFonts()
        sendResponse({ success: true })
        break

      case "updateCustomUrlStatus":
        activeCustomUrls = message.data
          .filter(item => item.isActive)
          .map(item => item.url)
        await initializeFonts()
        sendResponse({ success: true })
        break

      case "updateFont":
        const shouldApply = await shouldApplyFonts()
        if (shouldApply) {
          updateFont(message.fontName)
          try {
            await storage.set("selectedFont", message.fontName)
            sendResponse({ success: true })
          } catch (error) {
            sendResponse({ success: false, error: String(error) })
          }
        } else {
          sendResponse({ success: false, error: "URL not matched or extension disabled." })
        }
        break

      case "setActiveStatus":
        if (message.isActive) {
          await initializeFonts()
        }
        sendResponse({ success: true })
        break

      case "toggle":
        isExtensionEnabled = message.isExtensionEnabled
        if (isExtensionEnabled) {
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
    return true
  }
)