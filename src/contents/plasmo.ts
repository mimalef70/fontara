import { Storage } from "@plasmohq/storage"
import { googleFonts, localFonts } from "./plasmoContent/fonts"
import type { BrowserMessage, MessageResponse, UrlItem } from "./plasmoContent/types"
import { isCurrentUrlMatched } from "./plasmoContent/urlUtils"
import { loadFont, updateRootVariable } from "./plasmoContent/fontFunc"

const storage = new Storage()

declare const chrome: any
declare const browser: any
const browserAPI: typeof chrome = typeof browser !== "undefined" ? browser : chrome

let currentFont = "Estedad"
let activePopularUrls: string[] = []
let activeCustomUrls: string[] = []
let isExtensionEnabled = true

const rootStyle = document.createElement('style')
rootStyle.id = 'fontara-root-styles'
document.head.appendChild(rootStyle)

export async function shouldApplyFonts(): Promise<boolean> {
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

export function getAllElementsWithFontFamily(rootNode: HTMLElement): void {
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

    const resetElementStyles = (node: HTMLElement) => {
      // Reset font family
      node.style.removeProperty('font-family');
      if (node.style.length === 0) {
        node.removeAttribute('style');
      }

      // Handle Shadow DOM
      if (node.shadowRoot) {
        const shadowElements = node.shadowRoot.querySelectorAll('*');
        shadowElements.forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.removeProperty('font-family');
            if (element.style.length === 0) {
              element.removeAttribute('style');
            }
          }
        });
      }

      // Handle iframes
      if (node instanceof HTMLIFrameElement) {
        try {
          const iframeDoc = node.contentDocument || node.contentWindow?.document;
          if (iframeDoc?.body) {
            resetElementStyles(iframeDoc.body);
          }
        } catch (e) {
          // Handle cross-origin iframe errors silently
        }
      }
    };

    // Reset body
    resetElementStyles(document.body);

    // Reset all elements in main document
    const elements = document.querySelectorAll('*');
    elements.forEach((element) => {
      if (element instanceof HTMLElement) {
        resetElementStyles(element);
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
  (message: BrowserMessage, sender: any, sendResponse: (response: MessageResponse) => void) => {
    // Create an async wrapper function to handle the message
    (async () => {
      try {
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
              await storage.set("selectedFont", message.fontName)
              sendResponse({ success: true })
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
    } else if (mutation.type === "attributes" &&
      mutation.target instanceof HTMLElement &&
      mutation.attributeName === "style") {
      getAllElementsWithFontFamily(mutation.target)
    }
  })
})