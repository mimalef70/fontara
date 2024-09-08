import fontDana from "data-base64:../../assets/fonts/dana/variable/Dana-Regular.woff2"
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
  Morraba: fontMorraba,
  Dana: fontDana
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
  applyFontToBody(currentFont)
}

function loadFont(fontName: string) {
  if (fontName in localFonts) {
    const style = document.createElement("style")
    style.id = `${fontName}-style`
    style.textContent = `
      @font-face {
        font-family: ${fontName};
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

function applyFontToBody(customFont: string) {
  const body = document.body
  if (body) {
    let fontFamily = window.getComputedStyle(body).fontFamily

    // Remove any previously added custom fonts
    const customFonts = Object.keys(localFonts).concat(Object.keys(googleFonts))
    customFonts.forEach((font) => {
      fontFamily = fontFamily.replace(new RegExp(`${font},?\\s*`, "i"), "")
    })

    // Create a style element
    const style = document.createElement("style")
    style.textContent = `
      :root {
        --custom-font: ${customFont}, ${fontFamily.trim()};
      }
      body, body * {
        font-family: var(--custom-font) !important;
      }
    `

    // Remove any previously added style element
    const existingStyle = document.getElementById("custom-font-style")
    if (existingStyle) {
      existingStyle.remove()
    }

    // Add an ID to the style element and append it to the head
    style.id = "custom-font-style"
    document.head.appendChild(style)
  }
}

function initializeFonts() {
  if (document.body) {
    storage.get("selectedFont").then((storedFont) => {
      currentFont = storedFont || "Estedad"
      loadFont(currentFont)
      applyFontToBody(currentFont)
    })
  }
}

// Run the initialization
initializeFonts()
