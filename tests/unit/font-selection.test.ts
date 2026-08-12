import assert from "node:assert/strict"
import test, { afterEach } from "node:test"

import { DEFAULT_VALUES } from "../../src/config/storage"
import type { CustomFontFamily } from "../../src/custom-font-types"
import { resolveFontSelection } from "../../src/generators/font-selection"
import {
  createGoogleFontValue,
  resetGoogleFontCatalogForTesting
} from "../../src/utils/google-fonts"
import {
  createSystemFontValue,
  resetSystemFontLoaderForTesting
} from "../../src/utils/system-fonts"

const originalChrome = Reflect.get(globalThis, "chrome") as unknown
const originalChromium = Reflect.get(globalThis, "__CHROMIUM_MV3__") as unknown
const originalFirefox = Reflect.get(globalThis, "__FIREFOX_MV3__") as unknown
const originalFetch = Reflect.get(globalThis, "fetch") as unknown

afterEach(() => {
  resetGoogleFontCatalogForTesting()
  resetSystemFontLoaderForTesting()
  Reflect.set(globalThis, "chrome", originalChrome)
  Reflect.set(globalThis, "__CHROMIUM_MV3__", originalChromium)
  Reflect.set(globalThis, "__FIREFOX_MV3__", originalFirefox)
  Reflect.set(globalThis, "fetch", originalFetch)
})

function createCustomFont(
  value: string,
  name = "Runtime Custom"
): CustomFontFamily {
  return {
    value,
    displayName: name,
    sourceFamilyKey: name.toLowerCase(),
    unicodeRange: null,
    revision: 3,
    faces: [
      {
        id: `${value}-face`,
        fileHash: "a".repeat(64),
        fileName: `${name}.woff2`,
        format: "woff2",
        byteLength: 4,
        weight: { min: 400, max: 400 },
        style: "normal",
        stretch: { min: 100, max: 100 },
        axes: [],
        validation: "verified"
      }
    ]
  }
}

test("font selection resolver keeps bundled fonts without extra assets", async () => {
  const font = await resolveFontSelection("Estedad-Fontara")

  assert.deepEqual(font, {
    customFontFamilyRevision: null,
    customFontFamilyValue: null,
    fontName: "Estedad-Fontara",
    googleFontCSS: null
  })
})

test("font selection resolver emits only selected custom family metadata", async () => {
  const selectedFont = createCustomFont("Selected-Fontara", "Selected")
  const ignoredFont = createCustomFont("Ignored-Fontara", "Ignored")
  const font = await resolveFontSelection(selectedFont.value, {
    customFontList: [selectedFont, ignoredFont]
  })

  assert.equal(font.fontName, selectedFont.value)
  assert.equal(font.customFontFamilyValue, selectedFont.value)
  assert.equal(font.customFontFamilyRevision, selectedFont.revision)
  assert.equal(font.googleFontCSS, null)
})

test("font selection resolver falls back when optional font sources are disabled", async () => {
  const systemFontValue = createSystemFontValue("Arial")
  assert.ok(systemFontValue)

  const font = await resolveFontSelection(systemFontValue, {
    systemFontsEnabled: false
  })

  assert.deepEqual(font, {
    customFontFamilyRevision: null,
    customFontFamilyValue: null,
    fontName: DEFAULT_VALUES.SELECTED_FONT,
    googleFontCSS: null
  })
})

test("font selection resolver falls back when an enumerated system font was removed", async () => {
  Reflect.set(globalThis, "__CHROMIUM_MV3__", true)
  Reflect.set(globalThis, "__FIREFOX_MV3__", false)
  Reflect.set(globalThis, "chrome", {
    fontSettings: {
      getFontList(callback: (fonts: chrome.fontSettings.FontName[]) => void) {
        callback([{ displayName: "Installed Font", fontId: "Installed Font" }])
      }
    },
    runtime: { lastError: undefined }
  })
  const removedSystemFont = createSystemFontValue("Removed Font")
  assert.ok(removedSystemFont)

  const font = await resolveFontSelection(removedSystemFont, {
    systemFontsEnabled: true
  })

  assert.deepEqual(font, {
    customFontFamilyRevision: null,
    customFontFamilyValue: null,
    fontName: DEFAULT_VALUES.SELECTED_FONT,
    googleFontCSS: null
  })
})

test("font selection resolver falls back when a Google family is missing from the catalog", async () => {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      getURL(assetPath: string) {
        return `chrome-extension://fontara/${assetPath}`
      }
    }
  })
  Reflect.set(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          fonts: [
            {
              category: "sans-serif",
              fallback: "sans-serif",
              family: "Inter",
              recommended: true,
              subsets: ["latin"],
              variants: ["regular", "700"]
            }
          ],
          source: "google-fonts-developer-api-v1"
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200
        }
      )
  )

  const font = await resolveFontSelection(
    createGoogleFontValue("Missing Catalog Font"),
    { googleFontsEnabled: true }
  )

  assert.deepEqual(font, {
    customFontFamilyRevision: null,
    customFontFamilyValue: null,
    fontName: DEFAULT_VALUES.SELECTED_FONT,
    googleFontCSS: null
  })
})
