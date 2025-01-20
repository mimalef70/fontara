import { googleFonts, localFonts } from "../../utils/fonts"

const rootStyle = document.createElement("style")
rootStyle.id = "fontara-root-styles"
document.head.appendChild(rootStyle)

export function updateRootVariable(fontName: string): void {
  rootStyle.textContent = `
    :root {
      --fontara-font: "${fontName}";
    }
  `
}

export async function loadFont(fontName: string): Promise<void> {
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
