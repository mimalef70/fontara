import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { GOOGLE_FONTS_CATALOG_SOURCE } from "../../src/config/generated/google-fonts"
import { GOOGLE_FONTS } from "../../src/config/google-fonts"
import {
  buildGoogleFontsCSS2URL,
  createGoogleFontValue,
  decodeGoogleFontValue,
  getGoogleFontByFamily,
  getGoogleFontByValue,
  getGoogleFontList,
  isGoogleFontValue,
  loadGoogleFontFaceCSS,
  sanitizeGoogleFontFaceCSS
} from "../../src/utils/google-fonts"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalFetch = Reflect.get(globalThis, "fetch") as unknown

afterEach(() => {
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "fetch", originalFetch)
})

test("Google Font values encode only catalog families", () => {
  const value = createGoogleFontValue("Noto Sans Arabic")

  assert.equal(value, "google-font:Noto%20Sans%20Arabic")
  assert.equal(decodeGoogleFontValue(value), "Noto Sans Arabic")
  assert.equal(isGoogleFontValue(value), true)
  assert.equal(getGoogleFontByValue(value)?.family, "Noto Sans Arabic")
  assert.equal(
    getGoogleFontByFamily("noto sans arabic")?.family,
    "Noto Sans Arabic"
  )
  assert.equal(
    getGoogleFontByValue(createGoogleFontValue("Missing Font")),
    null
  )
})

test("Google Font display list exposes safe selectable data", () => {
  const fonts = getGoogleFontList()

  assert.equal(GOOGLE_FONTS_CATALOG_SOURCE, "google-fonts-developer-api-v1")
  assert.ok(GOOGLE_FONTS.length > 1000)
  assert.ok(fonts.length < GOOGLE_FONTS.length)
  assert.ok(fonts.some((font) => font.family === "Vazirmatn"))
  assert.ok(fonts.some((font) => font.family === "Inter"))
  assert.ok(fonts.some((font) => font.recommended))
  assert.equal(
    fonts.some((font) => font.family === "Material Icons"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Material Symbols Outlined"),
    false
  )
  assert.equal(
    fonts.some((font) => font.family === "Libre Barcode 128"),
    false
  )
  assert.equal(getGoogleFontByFamily("Material Icons"), null)
  assert.equal(
    getGoogleFontByValue(createGoogleFontValue("Material Symbols Outlined")),
    null
  )
  assert.ok(
    fonts.every(
      (font) =>
        font.value.startsWith("google-font:") &&
        font.name === font.family &&
        font.fontFamily === font.family &&
        Array.isArray(font.subsets) &&
        Array.isArray(font.variants)
    )
  )
  assert.equal(new Set(fonts.map((font) => font.family)).size, fonts.length)
})

test("Google Fonts CSS2 URLs request a single selected family with swap display", () => {
  const font = getGoogleFontByFamily("Noto Sans Arabic")
  assert.ok(font)

  const url = new URL(buildGoogleFontsCSS2URL(font))

  assert.equal(url.origin, "https://fonts.googleapis.com")
  assert.equal(url.pathname, "/css2")
  assert.equal(url.searchParams.get("family"), "Noto Sans Arabic")
  assert.equal(url.searchParams.get("display"), "swap")
})

test("Google Font CSS sanitizer keeps only matching gstatic font-face rules", () => {
  const sanitizedCSS = sanitizeGoogleFontFaceCSS(
    `
      /* latin */
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url(https://fonts.gstatic.com/s/inter/v20/test.woff2) format('woff2');
        unicode-range: U+0000-00FF;
      }
    `,
    "Inter"
  )

  assert.ok(sanitizedCSS)
  assert.match(sanitizedCSS, /@font-face/)
  assert.match(sanitizedCSS, /font-family: 'Inter';/)
  assert.match(
    sanitizedCSS,
    /https:\/\/fonts\.gstatic\.com\/s\/inter\/v20\/test\.woff2/
  )
  assert.doesNotMatch(sanitizedCSS, /\/\*/)

  assert.ok(
    sanitizeGoogleFontFaceCSS(
      `
        @font-face {
          font-family: 'Inter';
          src: url(https://fonts.gstatic.com/s/inter/v20/test.ttf) format('truetype');
        }
      `,
      "Inter"
    )
  )
})

test("Google Font CSS sanitizer rejects unexpected selectors and unsafe URLs", () => {
  assert.equal(
    sanitizeGoogleFontFaceCSS(
      `
        @import url(https://example.com/font.css);
        @font-face {
          font-family: 'Inter';
          src: url(https://fonts.gstatic.com/s/inter/v20/test.woff2) format('woff2');
        }
      `,
      "Inter"
    ),
    null
  )
  assert.equal(
    sanitizeGoogleFontFaceCSS(
      `
        @font-face {
          font-family: 'Inter';
          src: url(https://example.com/test.woff2) format('woff2');
        }
      `,
      "Inter"
    ),
    null
  )
  assert.equal(
    sanitizeGoogleFontFaceCSS(
      `
        @font-face {
          font-family: 'Roboto';
          src: url(https://fonts.gstatic.com/s/roboto/v30/test.woff2) format('woff2');
        }
      `,
      "Inter"
    ),
    null
  )
})

test("Google Font CSS loader skips network when cache-only mode has no cached CSS", async () => {
  let fetchCalls = 0

  Reflect.set(globalThis, "chrome", {
    runtime: {
      get lastError() {
        return undefined
      }
    },
    storage: {
      local: {
        get(key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ [key]: {} })
        },
        set(_items: Record<string, unknown>, callback: () => void) {
          callback()
        }
      }
    }
  })
  Reflect.set(globalThis, "fetch", async () => {
    fetchCalls += 1
    throw new Error("unexpected network request")
  })

  assert.equal(
    await loadGoogleFontFaceCSS(createGoogleFontValue("Inter"), {
      allowNetwork: false
    }),
    null
  )
  assert.equal(fetchCalls, 0)
})
