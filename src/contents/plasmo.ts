// import fontEstedad from "data-base64:../../assets/fonts/estedad/variable/Estedad[KSHD,wght].woff2"
// import type { PlasmoCSConfig } from "plasmo"

// import { Storage } from "@plasmohq/storage"

// export const config: PlasmoCSConfig = {
//   matches: ["<all_urls>"],
//   all_frames: true
// }

// const storage = new Storage()

// const localFonts = {
//   Estedad: fontEstedad
// }

// const googleFonts = {
//   Vazirmatn: "https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap"
// }

// let currentFont = "Estedad" // Default font in Font-Ara

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.action === "updateFont") {
//     currentFont = message.fontName
//     loadFont(currentFont)
//     getAllElementsWithFontFamily(document.body, currentFont)
//     sendResponse({ success: true })
//   }
// })

// function loadFont(fontName: string) {
//   if (fontName in localFonts) {
//     const style = document.createElement("style")
//     style.id = `${fontName}-style`
//     style.textContent = `
//       @font-face {
//         font-family: ${fontName};
//         src: url(${localFonts[fontName]}) format('woff-variations'),
//         url(${localFonts[fontName]}) format('woff');
//         font-weight: 100 1000;
//         font-display: fallback;
//       }
//     `
//     document.head.appendChild(style)
//   } else if (fontName in googleFonts) {
//     const link = document.createElement("link")
//     link.href = googleFonts[fontName]
//     link.rel = "stylesheet"
//     document.head.appendChild(link)
//   } else {
//     console.warn(`Font ${fontName} not found in local or Google fonts`)
//   }
// }

// function getAllElementsWithFontFamily(
//   rootNode: HTMLElement,
//   customFont: string
// ): void {
//   const treeWalker = document.createTreeWalker(
//     rootNode,
//     NodeFilter.SHOW_ELEMENT
//   )

//   let node: Node | null = treeWalker.nextNode()
//   while (node) {
//     if (node instanceof HTMLElement) {
//       const computedStyle = window.getComputedStyle(node)
//       const originalFontFamily = computedStyle.fontFamily

//       if (originalFontFamily && !originalFontFamily.includes(customFont)) {
//         node.style.fontFamily = `${customFont}, ${originalFontFamily}`
//       }
//     }

//     node = treeWalker.nextNode()
//   }
// }

// function initializeFonts() {
//   if (document.body) {
//     storage.get("selectedFont").then((result) => {
//       currentFont = result || "Estedad"
//       loadFont(currentFont)
//       getAllElementsWithFontFamily(document.body, currentFont)
//     })
//   }
// }

// function observeDOMChanges() {
//   const observer = new MutationObserver((mutationsList) => {
//     for (const mutation of mutationsList) {
//       if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
//         for (const addedNode of mutation.addedNodes) {
//           if (addedNode instanceof HTMLElement) {
//             getAllElementsWithFontFamily(addedNode, currentFont)
//           }
//         }
//       }
//     }
//   })

//   observer.observe(document.body, {
//     childList: true,
//     subtree: true
//   })
// }

// initializeFonts()
// observeDOMChanges()

// // Optional: You can keep this if you want to test messaging
// ;(async () => {
//   const resp = await chrome.runtime.sendMessage({
//     name: "ping",
//     body: {
//       id: 123
//     }
//   })
//   console.log(resp)
// })()

import fontEstedad from "data-base64:../../assets/fonts/estedad/variable/Estedad[KSHD,wght].woff2"
import fontMorraba from "data-base64:../../assets/fonts/morraba/variable/MorabbaVF.woff2"
import type { PlasmoCSConfig } from "plasmo"

import { Storage } from "@plasmohq/storage"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const storage = new Storage()

const localFonts = {
  Estedad: fontEstedad,
  Morraba: fontMorraba
}

const googleFonts = {
  Vazirmatn: "https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap"
}

let currentFont = "Estedad" // Default font

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateFont") {
    updateFont(message.fontName)
    sendResponse({ success: true })
  }
})

function updateFont(fontName: string) {
  currentFont = fontName
  loadFont(currentFont)
  getAllElementsWithFontFamily(document.body, currentFont)
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
      let fontFamily = computedStyle.fontFamily

      // Remove any previously added custom fonts
      const customFonts = Object.keys(localFonts).concat(
        Object.keys(googleFonts)
      )
      customFonts.forEach((font) => {
        fontFamily = fontFamily.replace(new RegExp(`${font},?\\s*`, "i"), "")
      })

      // Add the new custom font at the beginning
      node.style.fontFamily = `${customFont}, ${fontFamily.trim()}`
    }

    node = treeWalker.nextNode()
  }
}

function initializeFonts() {
  if (document.body) {
    storage.get("selectedFont").then((storedFont) => {
      currentFont = storedFont || "Estedad"
      loadFont(currentFont)
      getAllElementsWithFontFamily(document.body, currentFont)
    })
  }
}

function observeDOMChanges() {
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode instanceof HTMLElement) {
            getAllElementsWithFontFamily(addedNode, currentFont)
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
