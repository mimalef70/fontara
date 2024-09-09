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

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const storage = new Storage()

const localFonts = {
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

    const customFonts = Object.keys(localFonts).concat(Object.keys(googleFonts))
    customFonts.forEach((font) => {
      fontFamily = fontFamily.replace(new RegExp(`${font},?\\s*`, "i"), "")
    })

    const style = document.createElement("style")
    style.textContent = `
      :root {
        --custom-font: ${customFont}, ${fontFamily.trim()};
      }
      body, body * {
        font-family: var(--custom-font) !important;
      }
    `

    const existingStyle = document.getElementById("custom-font-style")
    if (existingStyle) {
      existingStyle.remove()
    }

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
