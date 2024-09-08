import fontEstedad from "data-base64:../../assets/fonts/estedad/variable/Estedad[KSHD,wght].woff2"
import type { PlasmoCSConfig } from "plasmo"

import { sendToBackground } from "@plasmohq/messaging"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const localFonts = {
  Estedad: fontEstedad
}

const googleFonts = {
  Vazirmatn: "https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap"
}

function loadFont(fontName: string) {
  if (fontName in localFonts) {
    const style = document.createElement("style")
    style.id = `${fontName}-style`
    style.textContent = `
      @font-face {
        font-family: ${fontName};
        src: url(${localFonts[fontName]}) format('woff-variations'),
        url(${localFonts[fontName]}) format('woff');
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

function getAllElementsWithFontFamily(
  rootNode: HTMLElement,
  customFont: string
): void {
  const treeWalker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_ELEMENT
  )

  let node: Node | null = treeWalker.nextNode()
  while (node) {
    if (node instanceof HTMLElement) {
      const computedStyle = window.getComputedStyle(node)
      const originalFontFamily = computedStyle.fontFamily

      if (originalFontFamily && !originalFontFamily.includes(customFont)) {
        node.style.fontFamily = `${customFont}, ${originalFontFamily}`
      }
    }

    node = treeWalker.nextNode()
  }
}

function initializeFonts() {
  if (document.body) {
    loadFont("Estedad")
    getAllElementsWithFontFamily(document.body, "Estedad")
  }
}

function observeDOMChanges() {
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode instanceof HTMLElement) {
            getAllElementsWithFontFamily(addedNode, "Estedad")
          }
        }
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

initializeFonts()
observeDOMChanges()
;(async () => {
  const resp = await sendToBackground({
    name: "ping",
    body: {
      id: 123
    }
  })
  console.log(resp)
})()
